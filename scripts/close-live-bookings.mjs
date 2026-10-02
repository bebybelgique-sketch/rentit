// Закрывает живые брони тестовых вещей ШТАТНЫМИ функциями — перед удалением.
//
// ЗАЧЕМ. С 01.10 вещь с живыми бронями нельзя удалить из «Mes outils» (#122):
// удаление каскадом стирало чужую заявку или бронь молча. Уборка после
// прогонов удаляла как раз такие вещи — тесты оставляют заявки и
// подтверждённые брони — и упала: 01.10 браузерный прогон на main дал три
// провала уборки в booking-journey и delivery. Обходить запрет не нужно:
// у каждой живой брони есть штатный выход, тот же, что у людей.
//
//   pending_approval → владелец отклоняет   (respond-to-request, reject)
//   confirmed        → владелец отменяет    (transition-booking, cancel)
//   active           → владелец завершает   (transition-booking, complete)
//
// pending_payment штатного выхода не имеет (платежей в продукте нет) — такая
// бронь попадает в отказы, и уборка о ней говорит, а не молчит.
//
// Клиент обязан быть вошедшим ВЛАДЕЛЬЦЕМ этих вещей: отклонить, отменить и
// завершить чужую бронь сервер не даст.

export const LIVE_BOOKING_STATUSES = ['pending_approval', 'pending_payment', 'confirmed', 'active']

const EXIT = {
  pending_approval: (id) => ['respond-to-request', { booking_id: id, action: 'reject' }],
  confirmed: (id) => ['transition-booking', { booking_id: id, action: 'cancel', reason: 'E2E : nettoyage' }],
  active: (id) => ['transition-booking', { booking_id: id, action: 'complete' }],
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client — вошедший владелец
 * @param {string[]} itemIds
 * @returns {Promise<{ found: number, closed: number, failures: string[] }>}
 */
export async function closeLiveBookings(client, itemIds) {
  if (!itemIds.length) return { found: 0, closed: 0, failures: [] }

  const { data, error } = await client
    .from('bookings')
    .select('id, status')
    .in('item_id', itemIds)
    .in('status', LIVE_BOOKING_STATUSES)
  if (error) throw new Error(`брони не прочитались: ${error.message}`)

  const failures = []
  for (const booking of data ?? []) {
    const exit = EXIT[booking.status]
    if (!exit) {
      failures.push(`${booking.id}: ${booking.status} — штатного выхода нет`)
      continue
    }
    const [fn, body] = exit(booking.id)
    const { error: fnError } = await client.functions.invoke(fn, { body })
    if (fnError) failures.push(`${booking.id}: ${fn} — ${fnError.message}`)
  }

  const found = (data ?? []).length
  return { found, closed: found - failures.length, failures }
}
