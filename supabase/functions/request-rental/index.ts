import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { computeRentalPrice } from '../_shared/pricing.ts'
import { notifyRental } from '../_shared/notify.ts'
import { checkRangeAvailable } from '../_shared/availability.ts'
import type { RpcCaller } from '../_shared/availability.ts'

const supabase = createSupabaseServiceClient()

// Оставлено для строк ниже, ещё не переведённых на json(): те же заголовки,
// что отдаёт _shared/cors.ts.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  try {
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return user

    const body = await req.json() as { item_id?: string; start_date?: string; end_date?: string; message?: string }
    const { item_id, start_date, end_date, message } = body
    if (!item_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: CORS })
    }

    // Validate dates: parsable, end >= start, start not in past
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid dates' }), { status: 400, headers: CORS })
    }
    if (end.getTime() < start.getTime()) {
      return new Response(JSON.stringify({ error: 'End date must be after or equal to start date' }), { status: 400, headers: CORS })
    }
    // Проверки «дата не в прошлом» здесь больше нет — не потому, что она
    // не нужна, а потому, что она стала частным случаем другой.
    //
    // Самая ранняя допустимая дата у вещи — `current_date + min_notice_days`
    // (функция `item_earliest_start`, миграция 20260817000022). При нулевом
    // сроке предупреждения это ровно «не раньше сегодня», то есть прежнее
    // правило целиком. Держать рядом две проверки одного и того же — то, из
    // чего и выросли семь копий расчёта занятости.
    //
    // Что здесь ОСТАЛОСЬ и почему: разбор дат и порядок концов проверяются
    // выше, до обращения к базе. И сравнение идёт строками YYYY-MM-DD, а не
    // датами: 12.08 на сравнении `Date` с моментом резался весь текущий
    // день, и «нужна дрель сегодня после обеда» не проходило вовсе.

    // Fetch item
    const { data: item, error: itemErr } = await supabase
      .from('items').select('id,owner_id,price_per_day,price_3days,price_week,deposit,available').eq('id', item_id).single()
    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404, headers: CORS })
    }

    if (item.owner_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot rent your own item' }), { status: 400, headers: CORS })
    }
    if (!item.available) {
      return new Response(JSON.stringify({ error: 'Item is not available' }), { status: 400, headers: CORS })
    }

    // Свободны ли даты. Раньше здесь стоял свой запрос с
    // `.lte('start_date', …).gte('end_date', …)` — пятое место, где даты
    // пересекались руками, и оно ничего не знало ни о количестве единиц,
    // ни о перерывах владельца. Теперь тот же вопрос, что задаёт
    // календарь на странице вещи, и тем же вызовом.
    const rpc: RpcCaller = (fn, args) => supabase.rpc(fn, args)
    const problem = await checkRangeAvailable(rpc, item_id, start_date, end_date)
    if (problem?.code === 'too_soon') {
      return new Response(
        JSON.stringify({ error: 'Item requires advance notice', earliest_start: problem.earliestStart }),
        { status: 409, headers: CORS },
      )
    }
    if (problem) {
      return new Response(
        JSON.stringify({ error: 'Item is not available for selected dates', day: problem.day }),
        { status: 409, headers: CORS },
      )
    }

    // Повторная заявка того же человека на пересекающиеся даты. Правило
    // про арендатора, а не про вещь, но пересечение считает та же
    // сторона — база (см. миграцию 20260817000022, раздел 9).
    const { data: duplicate } = await supabase.rpc('renter_has_pending_request', {
      p_item_id: item_id,
      p_renter_id: user.id,
      p_start: start_date,
      p_end: end_date,
    })

    if (duplicate) {
      return new Response(JSON.stringify({ error: 'You already have a pending request for these dates' }), { status: 409, headers: CORS })
    }

    // Calculate amounts for the booking record
    // ВАЖНО: формула числа дней сохранена как есть (product owner решает изменение)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1

    // Безопасное приведение цен: Number() + проверка
    const pricePerDay = Number(item.price_per_day)
    if (isNaN(pricePerDay) || pricePerDay <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid item price' }), { status: 400, headers: CORS })
    }
    // Тарифы на срок. Формула одна на клиента и сервер — файл
    // `_shared/pricing.ts`, из него же читает страница вещи. Считать здесь
    // «примерно так же» нельзя: человек увидел бы одну сумму, а в брони
    // оказалась бы другая.
    const { total: rentalPrice } = computeRentalPrice({
      pricePerDay,
      price3Days: item.price_3days,
      priceWeek: item.price_week,
    }, totalDays)
    const deposit = Number(item.deposit) || 0

    // Create booking with pending_approval
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert([{
        item_id,
        renter_id: user.id,
        start_date,
        end_date,
        total_price: rentalPrice,
        deposit_amount: deposit,
        platform_fee: 0,
        status: 'pending_approval',
        request_message: message?.trim() || null,
      }])
      .select('id')
      .single()

    if (bookingErr) {
      console.error(bookingErr)
      return new Response(JSON.stringify({ error: 'Could not create booking' }), { status: 400, headers: CORS })
    }

    // Notify owner
    await notifyRental(booking.id, 'pending_approval')

    return new Response(JSON.stringify({ booking_id: booking.id }), {
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
