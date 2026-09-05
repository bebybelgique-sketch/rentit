import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { notifyRental } from '../_shared/notify.ts'
import { checkRangeAvailable } from '../_shared/availability.ts'
import type { RpcCaller } from '../_shared/availability.ts'

const supabase = createSupabaseServiceClient()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  try {
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return user

    const body = await req.json() as { booking_id?: string; action?: string }
    const { booking_id, action } = body
    if (!booking_id || !['approve', 'reject'].includes(action || '')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid fields' }), { status: 400, headers: CORS })
    }

    // Fetch booking with item
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id,start_date,end_date,status,total_price,deposit_amount,items(id,owner_id,price_per_day,deposit)')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: CORS })
    }

    const item = (booking as any).items as any

    // Verify caller is the item owner
    if (item.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
    }

    // Must be pending_approval
    //
    // Эта проверка НЕ защищает от гонки: она смотрит на значение, прочитанное
    // выше, а между чтением и записью арендатор успевает отменить заявку.
    // Настоящая защита — условие по исходному статусу в самих UPDATE ниже,
    // как в `transition-booking`. Проверка здесь оставлена ради внятного
    // ответа человеку в обычном случае.
    if (booking.status !== 'pending_approval') {
      return new Response(JSON.stringify({ error: 'Booking is no longer pending approval' }), { status: 409, headers: CORS })
    }

    // Один и тот же ответ на проигранную гонку в обеих ветках: бронь
    // изменилась под руками, и владелец должен увидеть её заново, а не
    // получить «готово» о действии, которого не произошло.
    const changedMeanwhile = () => new Response(
      JSON.stringify({ error: 'La réservation a changé entre-temps' }),
      { status: 409, headers: CORS },
    )

    // --- REJECT ---
    if (action === 'reject') {
      const { data: rejected } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .eq('id', booking_id)
        .eq('status', 'pending_approval')
        .select('id')
      if (!rejected || rejected.length === 0) return changedMeanwhile()

      await notifyRental(booking_id, 'rejected')

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // --- APPROVE ---
    // Не заняли ли даты, пока заявка ждала ответа. Раньше здесь стоял свой
    // запрос с `.lte('start_date', …).gte('end_date', …)` — ещё одна копия
    // правила занятости, ничего не знавшая ни о количестве единиц, ни о
    // перерывах владельца. Тот же вопрос задаёт календарь на странице
    // вещи, и задаёт его теперь тем же вызовом.
    //
    // Срок предупреждения здесь НЕ проверяется намеренно: он относится к
    // тому, кто бронирует, а не к тому, кто отвечает. Иначе владелец не
    // смог бы одобрить заявку, поданную три дня назад на завтра.
    const rpc: RpcCaller = (fn, args) => supabase.rpc(fn, args)
    const problem = await checkRangeAvailable(rpc, item.id, booking.start_date, booking.end_date)
    if (problem?.code === 'unavailable') {
      return new Response(JSON.stringify({ error: 'These dates are no longer available' }), { status: 409, headers: CORS })
    }

    // Платежей в платформе нет: расчёт наличными между арендатором и
    // владельцем при передаче вещи. Поэтому одобрение сразу подтверждает
    // бронь — промежуточный статус pending_payment больше не используется,
    // Stripe не вызывается, запись в payments не создаётся.
    //
    // Итоговая сумма (total_price) и залог (deposit_amount) зафиксированы
    // снимком при создании заявки в request-rental (с учётом тарифов 3д/неделя).
    // Повторно их здесь не пересчитываем, чтобы не затереть скидки.
    //
    // Условие по исходному статусу обязательно. Без него отменённая
    // арендатором заявка поднималась обратно в `confirmed`: он считал бронь
    // отменённой, владелец — подтверждённой, вещь блокировалась на эти даты,
    // и разошлись бы они уже у двери.
    const { data: approved } = await supabase.from('bookings').update({
      status: 'confirmed',
      approved_at: new Date().toISOString(),
    }).eq('id', booking_id).eq('status', 'pending_approval').select('id')
    if (!approved || approved.length === 0) return changedMeanwhile()

    // Заявки, которые после этого одобрения стало невозможно исполнить.
    //
    // Раньше отклонялись ВСЕ остальные заявки с пересекающимися датами. С
    // одной единицей это верно, с двенадцатью одинаковыми стульями — прямой
    // убыток: владелец одобряет одну заявку и сам отказывает одиннадцати
    // людям, хотя стулья свободны. Вопрос не «пересекаются ли даты», а
    // «остались ли на эти дни свободные единицы», и отвечает на него та же
    // функция базы, что и везде (см. миграцию 20260817000022, раздел 10).
    const { data: conflicting } = await supabase.rpc('unservable_pending_requests', {
      p_item_id: item.id,
      p_exclude_booking: booking_id,
    })

    if (conflicting && conflicting.length > 0) {
      const ids = conflicting.map((b: any) => b.id)
      // Условие по статусу и здесь: между выборкой и записью арендатор
      // соседней заявки успевает отменить её сам. Письма шлём по
      // ВОЗВРАЩЁННЫМ строкам — сообщать надо о том, что вправду изменилось,
      // а не о том, что мы намеревались изменить.
      const { data: autoRejected } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .in('id', ids)
        .eq('status', 'pending_approval')
        .select('id')
      // Notify each rejected renter
      for (const b of autoRejected ?? []) {
        await notifyRental(b.id, 'rejected')
      }
    }

    // Notify renter that they're approved
    await notifyRental(booking_id, 'approved')

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
