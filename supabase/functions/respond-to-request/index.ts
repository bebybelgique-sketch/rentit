import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'

const supabase = createSupabaseServiceClient()

const PLATFORM_FEE_PCT = 0.00
const INSURANCE_PER_DAY = 0

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
      .select('id,start_date,end_date,status,items(id,owner_id,price_per_day,deposit)')
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // --- REJECT ---
    if (action === 'reject') {
      const { data: rejected } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .eq('id', booking_id)
        .eq('status', 'pending_approval')
        .select('id')
      if (!rejected || rejected.length === 0) return changedMeanwhile()

      await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ booking_id, event: 'rejected' }),
      }).catch(() => {})

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // --- APPROVE ---
    // Double-check no blocking conflict appeared since the request was made
    const { data: conflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item.id)
      .neq('id', booking_id)
      .in('status', ['pending_payment', 'confirmed', 'active'])
      .lte('start_date', booking.end_date)
      .gte('end_date', booking.start_date)
      .maybeSingle()

    if (conflict) {
      return new Response(JSON.stringify({ error: 'These dates are no longer available' }), { status: 409, headers: CORS })
    }

    // Check if owner is Pro or B2B
    const { data: ownerProfile } = await supabase
      .from('users').select('is_pro, business_plan').eq('id', user.id).single()
    const isPro = ownerProfile?.is_pro === true || ownerProfile?.business_plan != null

    // Calculate amounts
    const start = new Date(booking.start_date)
    const end = new Date(booking.end_date)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const pricePerDay = Number(item.price_per_day)
    if (isNaN(pricePerDay) || pricePerDay <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid item price' }), { status: 400, headers: CORS })
    }
    const rentalPrice = pricePerDay * totalDays
    const deposit = Number(item.deposit) || 0
    const platformFee = isPro ? 0 : rentalPrice * PLATFORM_FEE_PCT
    const insuranceFee = INSURANCE_PER_DAY * totalDays

    // Платежей в платформе нет: расчёт наличными между арендатором и
    // владельцем при передаче вещи. Поэтому одобрение сразу подтверждает
    // бронь — промежуточный статус pending_payment больше не используется,
    // Stripe не вызывается, запись в payments не создаётся.
    // Суммы ниже сохраняем: они показываются сторонам как ориентир.
    // Условие по исходному статусу обязательно. Без него отменённая
    // арендатором заявка поднималась обратно в `confirmed`: он считал бронь
    // отменённой, владелец — подтверждённой, вещь блокировалась на эти даты,
    // и разошлись бы они уже у двери.
    const { data: approved } = await supabase.from('bookings').update({
      status: 'confirmed',
      approved_at: new Date().toISOString(),
      total_price: rentalPrice,
      deposit_amount: deposit,
      platform_fee: platformFee,
    }).eq('id', booking_id).eq('status', 'pending_approval').select('id')
    if (!approved || approved.length === 0) return changedMeanwhile()

    // Auto-reject other pending_approval requests for overlapping dates
    const { data: conflicting } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item.id)
      .eq('status', 'pending_approval')
      .neq('id', booking_id)
      .lte('start_date', booking.end_date)
      .gte('end_date', booking.start_date)

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
        await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ booking_id: b.id, event: 'rejected' }),
        }).catch(() => {})
      }
    }

    // Notify renter that they're approved
    await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ booking_id, event: 'approved' }),
    }).catch(() => {})

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
