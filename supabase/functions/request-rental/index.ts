import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { computeRentalPrice } from '../_shared/pricing.ts'
import { notifyRental } from '../_shared/notify.ts'
import { checkRangeAvailable } from '../_shared/availability.ts'
import type { RpcCaller } from '../_shared/availability.ts'
import { json } from '../_shared/json.ts'

const supabase = createSupabaseServiceClient()

// ── ОТКАЗЫ — КОДАМИ ─────────────────────────────────────────────────
//
// До 23.09 эта функция одна из всех отвечала английскими фразами
// («Cannot rent your own item», «You already have a pending request…»).
// Клиент их всё равно не видел: supabase-js прячет тело ответа, и человек
// читал «Edge Function returned a non-2xx status code» — на французской
// странице, на экране, где он только что нажал «отправить заявку».
//
// Теперь код, а текст подбирает клиент на языке человека
// (src/domain/serverErrors.ts):
//
//   bad_request           400  нет полей, нечитаемые даты, конец раньше начала
//   item_not_found        404
//   own_item              400  своя вещь
//   item_unavailable      409  владелец снял вещь с аренды
//   too_soon              409  раньше срока предупреждения (+ earliest_start)
//   dates_unavailable     409  даты заняты (+ day)
//   duplicate_request     409  своя заявка на эти даты уже ждёт ответа
//   delivery_unavailable  400  доставки у вещи нет
//   internal_error        500  всё, в чём человек не виноват

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return user

    // Нечитаемое тело — ошибка запроса, а не сервера: прежде оно падало в
    // общий catch и отвечало 500.
    const body = await req.json().catch(() => null) as { item_id?: string; start_date?: string; end_date?: string; message?: string; delivery_requested?: boolean } | null
    const { item_id, start_date, end_date, message, delivery_requested } = body ?? {}
    if (!item_id || !start_date || !end_date) {
      return json({ error: 'bad_request' }, 400)
    }

    // Validate dates: parsable, end >= start, start not in past
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return json({ error: 'bad_request' }, 400)
    }
    if (end.getTime() < start.getTime()) {
      return json({ error: 'bad_request' }, 400)
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
      // Столбцы перечислены поимённо: новая колонка, забытая здесь, не
      // приедет вовсе, и снимок цены доставки записался бы из пустоты.
      .from('items').select('id,owner_id,price_per_day,price_3days,price_week,deposit,available,delivery_fee').eq('id', item_id).single()
    if (itemErr || !item) {
      return json({ error: 'item_not_found' }, 404)
    }

    if (item.owner_id === user.id) {
      return json({ error: 'own_item' }, 400)
    }
    if (!item.available) {
      return json({ error: 'item_unavailable' }, 409)
    }

    // Свободны ли даты. Раньше здесь стоял свой запрос с
    // `.lte('start_date', …).gte('end_date', …)` — пятое место, где даты
    // пересекались руками, и оно ничего не знало ни о количестве единиц,
    // ни о перерывах владельца. Теперь тот же вопрос, что задаёт
    // календарь на странице вещи, и тем же вызовом.
    const rpc: RpcCaller = (fn, args) => supabase.rpc(fn, args)
    const problem = await checkRangeAvailable(rpc, item_id, start_date, end_date)
    if (problem?.code === 'too_soon') {
      return json({ error: 'too_soon', earliest_start: problem.earliestStart }, 409)
    }
    if (problem) {
      return json({ error: 'dates_unavailable', day: problem.day }, 409)
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
      return json({ error: 'duplicate_request' }, 409)
    }

    // Calculate amounts for the booking record
    // ВАЖНО: формула числа дней сохранена как есть (product owner решает изменение)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1

    // Безопасное приведение цен: Number() + проверка
    const pricePerDay = Number(item.price_per_day)
    if (isNaN(pricePerDay) || pricePerDay <= 0) {
      // Цена вещи испорчена — человек тут ни при чём.
      console.error('[request-rental] у вещи нет цены:', item_id)
      return json({ error: 'internal_error' }, 500)
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

    // Доставка. Цену берём ИЗ ВЕЩИ, а не из тела запроса: браузер сообщает
    // только сам выбор. И отказываем, если услуги у вещи нет — иначе бронь
    // унесла бы обещание, которого владелец не давал.
    const deliveryRequested = delivery_requested === true
    const itemDeliveryFee = item.delivery_fee == null ? null : Number(item.delivery_fee)
    if (deliveryRequested && !(itemDeliveryFee != null && itemDeliveryFee > 0)) {
      return json({ error: 'delivery_unavailable' }, 400)
    }
    // Снимок: последующая правка цены владельцем не меняет условий этой
    // брони. В total_price доставка НЕ входит — там цена аренды.
    const deliveryFee = deliveryRequested ? itemDeliveryFee : null

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
        delivery_requested: deliveryRequested,
        delivery_fee: deliveryFee,
      }])
      .select('id')
      .single()

    if (bookingErr) {
      console.error(bookingErr)
      return json({ error: 'internal_error' }, 500)
    }

    // Notify owner
    await notifyRental(booking.id, 'pending_approval')

    return json({ booking_id: booking.id })
  } catch (err: any) {
    console.error(err)
    return json({ error: 'internal_error' }, 500)
  }
})
