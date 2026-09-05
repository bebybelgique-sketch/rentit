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

/**
 * Отказ КОДОМ, а не фразой.
 *
 * Раньше отсюда уходила смесь языков: английские и французские строки.
 * Клиент показывал серверный текст как есть —
 * то есть половина отказов приходила к франкоязычному человеку
 * по-английски, а голландцу оба варианта были одинаково чужими. Перевод —
 * дело клиента, у которого есть выбранный язык; дело сервера — назвать
 * причину так, чтобы её нельзя было перепутать. Список кодов и их
 * переводы: src/domain/serverErrors.ts.
 */
const fail = (code: string, status: number) =>
  new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  try {
    const user = await getUserFromAuthHeader(req)
    // Тело от auth-хелпера человеку не показывают: наружу уходит код, а
    // текст подбирает клиент. Разбор «нет заголовка / протух токен» и так
    // остаётся в логах функции.
    if (user instanceof Response) return fail('unauthorized', 401)

    const body = await req.json() as { booking_id?: string; action?: string }
    const { booking_id, action } = body
    if (!booking_id || !['approve', 'reject'].includes(action || '')) {
      return fail('bad_request', 400)
    }

    // Fetch booking with item
    //
    // Из вещи берём РОВНО то, что нужно для решения: её id (для проверки
    // занятости) и владельца (для проверки прав). Старые поля цены и залога
    // отсюда убраны намеренно — не потому, что лишние столбцы дороги, а
    // потому что доступное поле цены рядом с одобрением однажды снова
    // превратится в пересчёт. Снимок суммы делает request-rental, и брать
    // цену здесь больше не из чего.
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id,start_date,end_date,status,total_price,deposit_amount,items(id,owner_id)')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return fail('booking_not_found', 404)
    }

    const item = (booking as any).items as { id: string; owner_id: string } | null

    // Вещь может не приехать со связью: объявление удалено, или строку
    // отсекла политика чтения. Без этой проверки `item.owner_id` кидал бы
    // TypeError, и владелец видел бы 500 вместо внятного «объявления нет».
    if (!item) {
      return fail('item_not_found', 404)
    }

    // Verify caller is the item owner
    if (item.owner_id !== user.id) {
      return fail('forbidden', 403)
    }

    // Must be pending_approval
    //
    // Эта проверка НЕ защищает от гонки: она смотрит на значение, прочитанное
    // выше, а между чтением и записью арендатор успевает отменить заявку.
    // Настоящая защита — условие по исходному статусу в самих UPDATE ниже,
    // как в `transition-booking`. Проверка здесь оставлена ради внятного
    // ответа человеку в обычном случае.
    if (booking.status !== 'pending_approval') {
      return fail('not_pending', 409)
    }

    // Один и тот же ответ на проигранную гонку в обеих ветках: бронь
    // изменилась под руками, и владелец должен увидеть её заново, а не
    // получить «готово» о действии, которого не произошло.
    const changedMeanwhile = () => fail('booking_changed', 409)

    // --- REJECT ---
    if (action === 'reject') {
      const { data: rejected, error: rejectErr } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .eq('id', booking_id)
        .eq('status', 'pending_approval')
        .select('id')
      // Ошибку записи нельзя выдавать за проигранную гонку. Ноль строк и
      // отказ базы — разные события: первое значит «кто-то успел раньше»,
      // второе — «запись не прошла вовсе». Слив их в один 409, мы бы
      // отправили диагностику упавшего триггера искать несуществующего
      // конкурента.
      if (rejectErr) {
        console.error('[respond-to-request] reject failed', { booking_id, rejectErr })
        return fail('update_failed', 500)
      }
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
    // Если сама RPC отказала, `checkRangeAvailable` возвращает null и
    // пишет причину в лог (см. _shared/availability.ts): молчащая база не
    // должна запрещать владельцу отвечать на заявки, а последнее слово о
    // занятости всё равно за триггером на bookings.
    const rpc: RpcCaller = (fn, args) => supabase.rpc(fn, args)
    const problem = await checkRangeAvailable(rpc, item.id, booking.start_date, booking.end_date)

    // Разбор ПОЛНЫЙ и проверяемый компилятором. Раньше здесь стояло
    // `if (problem?.code === 'unavailable')`, и любой другой код молча
    // проваливался в одобрение — то есть новая причина отказа, добавленная
    // в RangeProblem, вступила бы в силу везде, кроме этого места, и
    // заметили бы это на занятой вещи.
    //
    // Заявка сама себе не мешает: занятость считает `unavailable_days`
    // (миграция 20260817000022, раздел 3), и статус pending_approval в её
    // списке отсутствует намеренно — заявок на одни даты может быть
    // несколько, вещь они не держат. Исключать текущую бронь из проверки
    // поэтому не нужно.
    if (problem) {
      switch (problem.code) {
        case 'unavailable':
          return fail('dates_unavailable', 409)
        // Срок предупреждения здесь НЕ препятствие: он относится к тому,
        // кто бронирует, а не к тому, кто отвечает. Иначе владелец не смог
        // бы одобрить заявку, поданную три дня назад на завтра.
        case 'too_soon':
          break
        default: {
          // Недостижимо, пока RangeProblem состоит из двух вариантов.
          // Строка нужна ради ошибки компиляции при появлении третьего.
          const unhandled: never = problem
          console.error('[respond-to-request] unknown range problem', unhandled)
          return fail('internal_error', 500)
        }
      }
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
    const { data: approved, error: approveErr } = await supabase.from('bookings').update({
      status: 'confirmed',
      approved_at: new Date().toISOString(),
    }).eq('id', booking_id).eq('status', 'pending_approval').select('id')
    if (approveErr) {
      console.error('[respond-to-request] approve failed', { booking_id, approveErr })
      return fail('update_failed', 500)
    }
    if (!approved || approved.length === 0) return changedMeanwhile()

    // Заявки, которые после этого одобрения стало невозможно исполнить.
    //
    // Раньше отклонялись ВСЕ остальные заявки с пересекающимися датами. С
    // одной единицей это верно, с двенадцатью одинаковыми стульями — прямой
    // убыток: владелец одобряет одну заявку и сам отказывает одиннадцати
    // людям, хотя стулья свободны. Вопрос не «пересекаются ли даты», а
    // «остались ли на эти дни свободные единицы», и отвечает на него та же
    // функция базы, что и везде (см. миграцию 20260817000022, раздел 10).
    const { data: conflicting, error: conflictErr } = await supabase.rpc('unservable_pending_requests', {
      p_item_id: item.id,
      p_exclude_booking: booking_id,
    })
    // Одобрение уже состоялось и отменять его из-за неудачной уборки
    // соседних заявок нельзя: владелец получил бы отказ на действие,
    // которое прошло. Но и промолчать нельзя — иначе заявки, которые никто
    // не сможет исполнить, останутся висеть у людей как живые.
    if (conflictErr) {
      console.error('[respond-to-request] unservable lookup failed', { booking_id, conflictErr })
    }

    if (conflicting && conflicting.length > 0) {
      const ids = conflicting.map((b: any) => b.id)
      // Условие по статусу и здесь: между выборкой и записью арендатор
      // соседней заявки успевает отменить её сам. Письма шлём по
      // ВОЗВРАЩЁННЫМ строкам — сообщать надо о том, что вправду изменилось,
      // а не о том, что мы намеревались изменить.
      const { data: autoRejected, error: autoRejectErr } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .in('id', ids)
        .eq('status', 'pending_approval')
        .select('id')
      if (autoRejectErr) {
        console.error('[respond-to-request] auto-reject failed', { booking_id, ids, autoRejectErr })
      }
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
    console.error('[respond-to-request] unhandled', err)
    return fail('internal_error', 500)
  }
})
