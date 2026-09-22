import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { json } from '../_shared/json.ts'
import { b64urlDecode, isAllowedPushEndpoint } from '../_shared/webPush.ts'
import { isPushLang } from '../_shared/pushCopy.ts'
import { vapidFromEnv } from '../_shared/push.ts'

// Подписка устройства на push-уведомления.
//
// Таблица push_subscriptions закрыта для клиента целиком (миграция 40):
// сюда идут ВСЕ операции с ней, и каждая — только над подписками того,
// кто вошёл. Адрес подписки — ключ, по которому человеку можно слать
// сообщения; чужие адреса не отдаются и не меняются никогда.
//
// Отказы — КОДАМИ. Текст подбирает клиент по языку человека
// (src/domain/serverErrors.ts).
//
// Действия:
//   config       → публичный ключ VAPID, либо 503 push_not_configured
//   subscribe    → записать или перенять подписку этого устройства
//   unsubscribe  → снять подписку этого устройства
//   status       → есть ли подписка этого устройства у этого человека
//   lang         → язык этого устройства сменился

/**
 * Больше десяти устройств у одного человека не бывает по-честному. Предел
 * нужен не ради экономии места: каждое событие шлётся на КАЖДОЕ устройство,
 * и без предела один человек мог бы заставить сервер слать тысячи
 * запросов на событие. При переполнении уходят самые давние.
 */
const MAX_DEVICES = 10

const P256DH_BYTES = 65
const AUTH_BYTES = 16

const decodedLength = (value: unknown): number => {
  if (typeof value !== 'string' || value.length > 200) return -1
  try {
    return b64urlDecode(value).length
  } catch {
    return -1
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const user = await getUserFromAuthHeader(req)
  if (user instanceof Response) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => null)
  if (!body || typeof body.action !== 'string') return json({ error: 'bad_request' }, 400)

  const vapid = vapidFromEnv()
  const supabase = createSupabaseServiceClient()
  const { action, endpoint } = body as { action: string; endpoint?: unknown }

  if (action === 'config') {
    // Канал не заведён — это состояние продукта, а не поломка, и сказано
    // это отдельным кодом. Клиент тогда не предлагает уведомлений вовсе.
    if (!vapid) return json({ error: 'push_not_configured' }, 503)
    return json({ publicKey: vapid.publicKey })
  }

  // Для всего остального нужен адрес этого устройства.
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return json({ error: 'bad_request' }, 400)

  if (action === 'status') {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return json({ error: 'internal_error' }, 500)
    return json({ subscribed: Boolean(data) })
  }

  if (action === 'unsubscribe') {
    // Повторное снятие — не ошибка: итог тот же, подписки нет.
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)
    if (error) return json({ error: 'update_failed' }, 500)
    return json({ ok: true })
  }

  if (action === 'lang') {
    if (!isPushLang(body.lang)) return json({ error: 'bad_request' }, 400)
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ lang: body.lang, updated_at: new Date().toISOString() })
      .eq('endpoint', endpoint)
      .eq('user_id', user.id)
    if (error) return json({ error: 'update_failed' }, 500)
    return json({ ok: true })
  }

  if (action === 'subscribe') {
    if (!vapid) return json({ error: 'push_not_configured' }, 503)

    // Адрес приходит от клиента, а сервер потом шлёт на него запросы.
    // Только службы уведомлений настоящих браузеров — иначе SSRF.
    if (!isAllowedPushEndpoint(endpoint)) return json({ error: 'push_endpoint_unsupported' }, 400)

    const { p256dh, auth } = body as { p256dh?: unknown; auth?: unknown }
    const p256dhBytes = decodedLength(p256dh)
    if (p256dhBytes !== P256DH_BYTES || b64urlDecode(p256dh as string)[0] !== 0x04) {
      return json({ error: 'bad_request' }, 400)
    }
    if (decodedLength(auth) !== AUTH_BYTES) return json({ error: 'bad_request' }, 400)

    const lang = isPushLang(body.lang) ? body.lang : 'fr'
    const now = new Date().toISOString()

    // Один адрес — один человек. Если на этом устройстве раньше был
    // подписан кто-то другой, подписка переходит к вошедшему: иначе
    // прежний получал бы его уведомления на чужом устройстве.
    const { error } = await supabase.from('push_subscriptions').upsert(
      { endpoint, user_id: user.id, p256dh, auth, lang, updated_at: now },
      { onConflict: 'endpoint' },
    )
    if (error) return json({ error: 'update_failed' }, 500)

    // Предел устройств: лишние — самые давние.
    const { data: devices } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    const extra = (devices ?? []).slice(MAX_DEVICES).map((d: { endpoint: string }) => d.endpoint)
    if (extra.length) await supabase.from('push_subscriptions').delete().in('endpoint', extra)

    return json({ ok: true })
  }

  return json({ error: 'bad_request' }, 400)
})
