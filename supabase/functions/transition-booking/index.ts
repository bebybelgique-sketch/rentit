// supabase/functions/transition-booking/index.ts
//
// Единственный владелец машины состояний брони.
//
// Почему одна функция, а не отдельная cancel-booking: правило «прямую смену
// статуса из клиента не давать» нельзя выполнить наполовину. Пока передача и
// возврат делались сырым update из браузера (MyItems.tsx), любой мог перевести
// чужую бронь в completed и открыть себе право на отзыв. Отмена, передача и
// возврат живут здесь вместе, потому что это один инвариант, а не три.
//
// Одобрение и отклонение остаются в respond-to-request: там своя проверка
// занятости дат и авто-отклонение пересекающихся заявок.
//
//   pending_approval ── арендатор отменяет ──→ cancelled
//   confirmed ──────── любая сторона отменяет ─→ cancelled
//   confirmed ──────── передача состоялась ───→ active     (владелец)
//   active ────────── возврат состоялся ─────→ completed  (владелец)
//
// completed — единственное состояние, открывающее взаимные отзывы.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { json } from '../_shared/json.ts'
import type { BookingStatus } from '../_shared/types.ts'
import { notifyRental, type RentalEvent } from '../_shared/notify.ts'

const supabase = createSupabaseServiceClient()

type Action = 'cancel' | 'handover' | 'complete'
type Party = 'renter' | 'owner'

interface Rule {
  action: Action
  from: BookingStatus
  to: BookingStatus
  who: Party[]
  // Не `string`: событие, которого notify-rental не знает, она молча
  // проигнорирует, и письмо не уйдёт без единой жалобы. Пусть опечатку
  // ловит тип.
  event: RentalEvent
}

// Таблица переходов — единственное место, где записано, что вообще возможно.
// Всё, чего здесь нет, запрещено: неизвестное сочетание отвергается, а не
// трактуется на усмотрение кода.
const RULES: Rule[] = [
  { action: 'cancel',   from: 'pending_approval', to: 'cancelled', who: ['renter'],           event: 'cancelled' },
  { action: 'cancel',   from: 'confirmed',        to: 'cancelled', who: ['renter', 'owner'],  event: 'cancelled' },
  { action: 'handover', from: 'confirmed',        to: 'active',    who: ['owner'],            event: 'active'    },
  { action: 'complete', from: 'active',           to: 'completed', who: ['owner'],            event: 'completed' },
]

const ACTIONS: Action[] = ['cancel', 'handover', 'complete']
const MAX_REASON = 500

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  try {
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return user

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Invalid JSON body' }, 400)

    const { booking_id, action, reason } = body as {
      booking_id?: string
      action?: Action
      reason?: string | null
    }

    if (!booking_id || !action || !ACTIONS.includes(action)) {
      return json({ error: 'Missing or invalid fields: booking_id, action' }, 400)
    }
    if (reason != null && typeof reason !== 'string') {
      return json({ error: 'reason must be a string' }, 400)
    }

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, status, renter_id, item_id, items!inner(owner_id)')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) return json({ error: 'Booking not found' }, 404)

    const ownerId = (booking.items as unknown as { owner_id: string }).owner_id

    // Кто спрашивает. Посторонний не должен узнать даже состояние брони,
    // поэтому 403 идёт раньше разбора самого перехода.
    let party: Party | null = null
    if (booking.renter_id === user.id) party = 'renter'
    else if (ownerId === user.id) party = 'owner'
    if (!party) return json({ error: 'Forbidden' }, 403)

    const rule = RULES.find((r) => r.action === action && r.from === booking.status)
    if (!rule) {
      return json(
        { error: `Impossible: action "${action}" depuis le statut "${booking.status}"` },
        409,
      )
    }
    if (!rule.who.includes(party)) {
      return json({ error: 'Cette action ne vous appartient pas' }, 403)
    }

    const patch: Record<string, unknown> = { status: rule.to }
    if (rule.to === 'cancelled') {
      patch.cancelled_by = user.id
      patch.cancelled_at = new Date().toISOString()
      patch.cancellation_reason = reason?.trim() ? reason.trim().slice(0, MAX_REASON) : null
    }

    // Условие по исходному статусу — защита от гонки: если вторая сторона
    // успела сменить статус между чтением и записью, обновится ноль строк,
    // и мы честно сообщим о конфликте вместо тихой перезаписи.
    const { data: updated, error: updateErr } = await supabase
      .from('bookings')
      .update(patch)
      .eq('id', booking_id)
      .eq('status', rule.from)
      .select('id, status')

    if (updateErr) return json({ error: updateErr.message }, 500)
    if (!updated || updated.length === 0) {
      return json({ error: 'La réservation a changé entre-temps' }, 409)
    }

    // Письма не должны валить переход: он уже произошёл и зафиксирован.
    // notifyRental наружу не бросает, но и не молчит — исход в логе.
    await notifyRental(booking_id, rule.event)

    return json({ ok: true, status: rule.to })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
