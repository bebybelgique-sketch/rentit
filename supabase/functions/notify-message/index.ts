import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { json } from '../_shared/json.ts'
import { pushToUser, supabaseDeps } from '../_shared/push.ts'

// Уведомить собеседника о новом сообщении в переписке брони.
//
// ── ПОЧЕМУ ОТДЕЛЬНАЯ ФУНКЦИЯ, А НЕ ТРИГГЕР В БАЗЕ ────────────────────
//
// Сообщение пишет сам клиент, прямо в booking_messages, — серверного
// события у него нет. Триггер с pg_net потребовал бы хранить секрет
// вызова внутри Postgres и засевать его руками на каждой базе, а ручной
// шаг, который однажды забудут, — дефект плана. Поэтому клиент зовёт эту
// функцию сразу после отправки.
//
// ── ПОЧЕМУ ВЫЗОВ КЛИЕНТОМ НЕ ДЫРА ────────────────────────────────────
//
// Звать можно только о СВОЁМ сообщении (отправитель = вошедший), только
// о СВЕЖЕМ (не старше пяти минут) и только ОДИН РАЗ: отметка `message:<id>`
// в push_sent ставится вставкой по уникальному ключу, и повторный или
// одновременный вызов упирается в него. Худшее, что может сделать
// недобросовестный клиент, — не позвать функцию и остаться без
// уведомления о собственном сообщении.
//
// ── ЧЕГО ЗДЕСЬ НЕ БЫВАЕТ ─────────────────────────────────────────────
//
// Номера телефона в тексте уведомления: превью проходит маску (см.
// maskSensitive в _shared/pushCopy.ts). Экран блокировки публичен.

/** Окно, в которое о сообщении ещё уведомляют. */
const FRESH_MS = 5 * 60 * 1000
/** Отметки старше суток не нужны никому: окно уведомления — пять минут. */
const CLAIM_TTL_MS = 24 * 3600 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const user = await getUserFromAuthHeader(req)
  if (user instanceof Response) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  const messageId = body?.message_id
  if (typeof messageId !== 'string' || !UUID.test(messageId)) return json({ error: 'bad_request' }, 400)

  const supabase = createSupabaseServiceClient()

  const { data: msg, error: msgError } = await supabase
    .from('booking_messages')
    .select('id, booking_id, sender_id, body, created_at')
    .eq('id', messageId)
    .maybeSingle()
  if (msgError) return json({ error: 'internal_error' }, 500)
  if (!msg) return json({ error: 'not_found' }, 404)

  // О чужом сообщении уведомлять нельзя — даже его участнику.
  if (msg.sender_id !== user.id) return json({ error: 'forbidden' }, 403)

  if (Date.now() - Date.parse(msg.created_at) > FRESH_MS) {
    return json({ ok: true, skipped: 'stale' })
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, renter_id, items!inner(owner_id, title)')
    .eq('id', msg.booking_id)
    .single()
  if (bookingError || !booking) return json({ error: 'internal_error' }, 500)

  // deno-lint-ignore no-explicit-any
  const item = booking.items as any
  const ownerId: string = item?.owner_id
  // Отправитель обязан быть стороной брони. Вставку и так пропускает
  // только участника (политика «Participants send booking messages»), но
  // проверка на своей стороне дешевле, чем вера в чужую.
  if (msg.sender_id !== booking.renter_id && msg.sender_id !== ownerId) {
    return json({ error: 'forbidden' }, 403)
  }
  const recipient = msg.sender_id === booking.renter_id ? ownerId : booking.renter_id

  // Одно сообщение — одно уведомление. Вставка по уникальному ключу:
  // второй вызов упирается в ключ (23505) и уходит ни с чем. Отметка
  // ставится ПОСЛЕДНЕЙ, после всех проверок: отказ выше не должен
  // сжигать право на уведомление.
  const { error: claimError } = await supabase.from('push_sent').insert({ event_key: `message:${msg.id}` })
  if (claimError) {
    if (claimError.code === '23505') return json({ ok: true, skipped: 'duplicate' })
    return json({ error: 'internal_error' }, 500)
  }

  const { data: sender } = await supabase.from('users').select('full_name').eq('id', msg.sender_id).maybeSingle()

  // Только push. Строку в ленту о сообщении пишет сама база — триггером
  // на booking_messages, в той же транзакции, что и сообщение (миграция
  // 42): она не должна зависеть от того, дойдёт ли этот вызов из браузера.
  await pushToUser(
    supabaseDeps(supabase),
    recipient,
    'new_message',
    { otherName: sender?.full_name ?? null, messageBody: msg.body, itemTitle: item?.title ?? null },
    booking.id,
  )

  // Подчистка отметок. Неудача здесь ничего не ломает — следующий вызов
  // подчистит снова.
  await supabase
    .from('push_sent')
    .delete()
    .lt('sent_at', new Date(Date.now() - CLAIM_TTL_MS).toISOString())
    .then(() => {}, () => {})

  // Отправителю — только «принято». Сколько у собеседника устройств и
  // включены ли у него уведомления вообще, отправитель знать не должен:
  // счёт уже в логе (pushToUser), наружу он не выходит.
  return json({ ok: true })
})
