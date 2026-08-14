// Единственный способ позвать notify-rental.
//
// До 14.08 шесть мест звали её одинаковым куском на семь строк, и все
// шесть заканчивались `.catch(() => {})`. Две дыры сразу:
//
//  1) `.catch()` ловит ТОЛЬКО обрыв сети. Когда notify-rental падает
//     изнутри — а она падает, если не задан RESEND_API_KEY, — она
//     отвечает 500, и `fetch` РЕЗОЛВИТСЯ УСПЕШНО. Никто не смотрел
//     `res.ok`, поэтому провал был невидим даже без глушения;
//  2) пустой обработчик стирал и настоящие обрывы.
//
// Итог: письма не уходили ни по одному из девяти событий, и ни в одном
// логе об этом не было ни строки.
//
// Здесь исход всегда попадает в лог функции, но НАРУЖУ не бросается:
// бронь уже записана в базу, и ронять ответ пользователю из-за письма
// нельзя — он потеряет результат действия, которое на самом деле удалось.
// Тишина убрана, поведение сохранено.

// Список снят с самой notify-rental (её цепочка `if (event === …)`), а не
// выписан по памяти: с памяти он вышел неверным — `handed_over`,
// `returned`, `auto_closed` в продукте не существуют.
// Событие, которого здесь нет, notify-rental молча проигнорирует, поэтому
// список держим один на всех: notify-rental типизирует им свой вход.
export type RentalEvent =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'payment_expired'
  | 'confirmed'
  | 'cancelled'
  | 'active'
  | 'completed'

/** Зовёт notify-rental. Никогда не бросает. Любой исход пишется в лог. */
export async function notifyRental(bookingId: string, event: RentalEvent): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceKey) {
    console.error(`[notify] ${event} bookingId=${bookingId}: нет SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY, письмо не отправлено`)
    return
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ booking_id: bookingId, event }),
    })

    if (!res.ok) {
      // Тело читаем именно здесь: без него в логе остаётся голый код
      // состояния, и «нет ключа» неотличимо от «плохой адрес».
      const body = await res.text().catch(() => '(тело не прочиталось)')
      console.error(`[notify] ${event} bookingId=${bookingId}: notify-rental ответила ${res.status} — ${body.slice(0, 500)}`)
      return
    }

    console.log(`[notify] ${event} bookingId=${bookingId}: отправлено`)
  } catch (e) {
    console.error(`[notify] ${event} bookingId=${bookingId}: запрос не дошёл — ${e instanceof Error ? e.message : String(e)}`)
  }
}
