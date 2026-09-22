// Web Push: подпись VAPID (RFC 8292) и шифрование содержимого (RFC 8291,
// кодировка aes128gcm из RFC 8188).
//
// ── ПОЧЕМУ СВОЁ, А НЕ БИБЛИОТЕКА ─────────────────────────────────────
//
// Готовая `web-push` написана под Node: `crypto.createECDH`, модуль
// `https`. В Deno она держится на слое совместимости, и то, что она
// работает на моей машине, ничего не говорит о среде Supabase.
//
// Здесь только WebCrypto — он одинаковый в Deno (edge-функции) и в Node
// (набор vitest). Поэтому код, который шифрует уведомление в проде, —
// это РОВНО тот код, который проверяет набор, без подмен и заглушек.
//
// ── КАК ЭТО ПРОВЕРЕНО ────────────────────────────────────────────────
//
// По разобранному примеру из самого RFC 8291 (раздел 5 и приложение A),
// с его ключами, солью и ожидаемыми байтами — включая КАЖДОЕ
// промежуточное значение: общий секрет, оба ключа HKDF, ключ шифрования,
// nonce, заголовок. Если что-то разойдётся, тест покажет ступень, а не
// «не сошлось в конце». См. __tests__/webPush.test.ts.
//
// ── ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО ─────────────────────────────────────────
//
// Ни одного обращения к Deno.env и к базе. Ключи и адреса приходят
// параметрами: так модуль импортируется в Node без окружения Supabase, и
// его нельзя случайно заставить работать с «чьими-то» ключами.

const enc = new TextEncoder()

// ── base64url ───────────────────────────────────────────────────────

export const b64urlEncode = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Пробелы и переводы строк внутри допускаются: так значения записаны в RFC. */
export const b64urlDecode = (input: string): Uint8Array => {
  const s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// ── HKDF через HMAC — строка в строку по тексту RFC 8291 ────────────
//
// В WebCrypto есть готовый HKDF, но он делает извлечение и расширение
// одним шагом, и промежуточный ключ (PRK) из него не достать. А именно
// PRK и позволяют сверить реализацию с приложением A по ступеням.

/**
 * Байты — в обычный ArrayBuffer.
 *
 * Новые версии TypeScript различают `Uint8Array` поверх ArrayBuffer и
 * поверх SharedArrayBuffer, а WebCrypto и fetch принимают только первый.
 * Копия снимает вопрос при любой версии компилятора; данных здесь —
 * десятки байт.
 */
const buf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

const hmac = async (key: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
  const k = await crypto.subtle.importKey('raw', buf(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, buf(data)))
}

/** HKDF-Expand для длины до 32 байт: T(1) = HMAC(PRK, info || 0x01). */
const expand = async (prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> =>
  (await hmac(prk, concat(info, new Uint8Array([0x01])))).slice(0, length)

// ── Ключи P-256 ─────────────────────────────────────────────────────

/** Публичный ключ в несжатом виде: 0x04 || X (32) || Y (32). */
const isUncompressedP256 = (key: Uint8Array): boolean => key.length === 65 && key[0] === 0x04

/** JWK из закрытого скаляра и несжатого публичного ключа. */
const privateJwk = (d: Uint8Array, publicKey: Uint8Array): JsonWebKey => ({
  kty: 'EC',
  crv: 'P-256',
  d: b64urlEncode(d),
  x: b64urlEncode(publicKey.slice(1, 33)),
  y: b64urlEncode(publicKey.slice(33, 65)),
  ext: true,
})

// ── Шифрование (RFC 8291) ───────────────────────────────────────────

/** Ключи из подписки браузера (`PushSubscription.toJSON().keys`). */
export interface SubscriptionKeys {
  /** Публичный ключ получателя, base64url, 65 байт. */
  readonly p256dh: string
  /** Секрет аутентификации, base64url, 16 байт. */
  readonly auth: string
}

/** Размер записи. Одна запись на сообщение: уведомления короткие. */
export const RECORD_SIZE = 4096

/**
 * Предел открытого текста.
 *
 * Службы уведомлений принимают тело до 4096 байт. Тело = заголовок (86) +
 * текст + разделитель (1) + метка GCM (16), отсюда 3993. Больше — и Google
 * ответит 413, а человек не получит ничего; лучше отказать здесь, с
 * понятной причиной, чем узнать об этом из лога службы.
 */
export const MAX_PLAINTEXT = RECORD_SIZE - 86 - 1 - 16

/** Детерминизм для проверки по RFC. В проде не передаётся. */
export interface EncryptFixture {
  /** Закрытый ключ отправителя, base64url 32 байта. */
  readonly senderPrivate: string
  /** Публичный ключ отправителя, base64url 65 байт. */
  readonly senderPublic: string
  /** Соль, base64url 16 байт. */
  readonly salt: string
}

/** Промежуточные значения — только ради проверки по приложению A. */
export interface EncryptTrace {
  readonly ecdhSecret: Uint8Array
  readonly prkKey: Uint8Array
  readonly keyInfo: Uint8Array
  readonly ikm: Uint8Array
  readonly prk: Uint8Array
  readonly cek: Uint8Array
  readonly nonce: Uint8Array
  readonly header: Uint8Array
  readonly ciphertext: Uint8Array
}

export async function encryptPayload(
  plaintext: Uint8Array,
  keys: SubscriptionKeys,
  fixture?: EncryptFixture,
): Promise<{ body: Uint8Array; trace: EncryptTrace }> {
  if (plaintext.length > MAX_PLAINTEXT) {
    throw new Error(`push_payload_too_large: ${plaintext.length} > ${MAX_PLAINTEXT}`)
  }

  const uaPublic = b64urlDecode(keys.p256dh)
  const authSecret = b64urlDecode(keys.auth)
  if (!isUncompressedP256(uaPublic)) throw new Error('push_bad_p256dh')
  if (authSecret.length !== 16) throw new Error('push_bad_auth')

  // Одноразовая пара ключей отправителя. Новая на каждое сообщение: в
  // этом и состоит защита — перехвативший одно сообщение не читает
  // остальные.
  let asPrivate: CryptoKey
  let asPublic: Uint8Array
  if (fixture) {
    asPublic = b64urlDecode(fixture.senderPublic)
    asPrivate = await crypto.subtle.importKey(
      'jwk',
      privateJwk(b64urlDecode(fixture.senderPrivate), asPublic),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
    asPrivate = pair.privateKey
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  }

  const uaKey = await crypto.subtle.importKey('raw', buf(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256))

  // Раздел 3.4: ключ сочетания — HKDF(auth_secret, ecdh_secret, key_info).
  const prkKey = await hmac(authSecret, ecdhSecret)
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0x00]), uaPublic, asPublic)
  const ikm = await expand(prkKey, keyInfo, 32)

  // RFC 8188: ключ и nonce содержимого — HKDF(salt, IKM, …).
  const salt = fixture ? b64urlDecode(fixture.salt) : crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = await expand(prk, concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0x00])), 16)
  const nonce = await expand(prk, concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0x00])), 12)

  // Единственная запись: текст и разделитель 0x02 («последняя запись»).
  const record = concat(plaintext, new Uint8Array([0x02]))
  const aesKey = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce), tagLength: 128 }, aesKey, buf(record)),
  )

  // Заголовок RFC 8188: соль · размер записи · длина идентификатора · ключ.
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE, false)
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic)

  return {
    body: concat(header, ciphertext),
    trace: { ecdhSecret, prkKey, keyInfo, ikm, prk, cek, nonce, header, ciphertext },
  }
}

// ── Подпись VAPID (RFC 8292) ────────────────────────────────────────

export interface VapidKeys {
  /** Публичный ключ сервера, base64url 65 байт. Тот же уходит браузеру. */
  readonly publicKey: string
  /** Закрытый скаляр, base64url 32 байта. Живёт только в секретах Supabase. */
  readonly privateKey: string
  /** Контакт для службы уведомлений: `mailto:` или https-адрес. */
  readonly subject: string
}

/**
 * Заголовок Authorization для службы уведомлений.
 *
 * Срок жизни подписи — 12 часов: RFC ограничивает его сутками, а меньший
 * срок сужает окно, в котором перехваченный заголовок годится повторно.
 */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowMs = Date.now()): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(nowMs / 1000) + 12 * 3600,
    sub: vapid.subject,
  }
  const signingInput =
    `${b64urlEncode(enc.encode(JSON.stringify(header)))}.${b64urlEncode(enc.encode(JSON.stringify(claims)))}`

  const publicKey = b64urlDecode(vapid.publicKey)
  if (!isUncompressedP256(publicKey)) throw new Error('vapid_bad_public_key')

  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk(b64urlDecode(vapid.privateKey), publicKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // WebCrypto отдаёт подпись сразу в виде r || s — ровно тот формат,
  // которого требует JWS для ES256. Переводить из DER не нужно.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)),
  )

  return `vapid t=${signingInput}.${b64urlEncode(signature)}, k=${vapid.publicKey}`
}

// ── Куда разрешено отправлять ───────────────────────────────────────

/**
 * Адрес подписки приходит ОТ КЛИЕНТА, а сервер потом шлёт на него
 * запросы. Без ограничения это готовый SSRF: подсунь внутренний адрес —
 * и функция сама постучится туда со своими правами.
 *
 * Поэтому принимаются только службы уведомлений настоящих браузеров:
 * Google (Chrome, Edge на Android, Samsung, Opera, Brave), Mozilla,
 * Apple, Microsoft (Edge на Windows). Новая служба не пройдёт — и это
 * видно в логе по коду `push_endpoint_unsupported`, а не тихо.
 */
const PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  return PUSH_HOSTS.has(url.hostname) || url.hostname.endsWith('.notify.windows.com')
}

// ── Отправка ────────────────────────────────────────────────────────

export interface PushTarget extends SubscriptionKeys {
  readonly endpoint: string
}

export type Urgency = 'very-low' | 'low' | 'normal' | 'high'

export interface SendOptions {
  /** Сколько секунд служба держит сообщение, если устройство вне сети. */
  readonly ttl: number
  readonly urgency: Urgency
  /**
   * Тема: новое сообщение с той же темой ЗАМЕНЯЕТ ещё не доставленное.
   * Устройство, пролежавшее сутки без сети, получит последнее состояние
   * брони, а не всю цепочку «новая заявка → заявка истекла».
   */
  readonly topic?: string
  /** Для проверки без сети. В проде не передаётся. */
  readonly fetchImpl?: typeof fetch
  readonly nowMs?: number
}

export type PushOutcome =
  /** Служба приняла сообщение. Доставка на устройство — уже её забота. */
  | { readonly kind: 'sent'; readonly status: number }
  /** Подписки больше нет: человек отписался, очистил данные, сменил браузер. */
  | { readonly kind: 'gone'; readonly status: number }
  /** Служба отказала по существу — лимит, ключ, размер. Подписка жива. */
  | { readonly kind: 'rejected'; readonly status: number; readonly detail: string }
  /** Не дошли до службы вовсе. */
  | { readonly kind: 'network'; readonly detail: string }

/** Тема по RFC 8030: до 32 знаков из алфавита base64url. */
export const isValidTopic = (topic: string): boolean => /^[A-Za-z0-9_-]{1,32}$/.test(topic)

export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
  vapid: VapidKeys,
  options: SendOptions,
): Promise<PushOutcome> {
  if (!isAllowedPushEndpoint(target.endpoint)) {
    return { kind: 'rejected', status: 0, detail: 'push_endpoint_unsupported' }
  }
  if (options.topic !== undefined && !isValidTopic(options.topic)) {
    return { kind: 'rejected', status: 0, detail: 'push_bad_topic' }
  }

  let body: Uint8Array
  let authorization: string
  try {
    ;({ body } = await encryptPayload(enc.encode(JSON.stringify(payload)), target))
    authorization = await vapidAuthorization(target.endpoint, vapid, options.nowMs)
  } catch (error) {
    return { kind: 'rejected', status: 0, detail: error instanceof Error ? error.message : String(error) }
  }

  const headers: Record<string, string> = {
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(Math.max(0, Math.floor(options.ttl))),
    Urgency: options.urgency,
    Authorization: authorization,
  }
  if (options.topic) headers.Topic = options.topic

  const doFetch = options.fetchImpl ?? fetch
  let res: Response
  try {
    res = await doFetch(target.endpoint, { method: 'POST', headers, body: buf(body) })
  } catch (error) {
    return { kind: 'network', detail: error instanceof Error ? error.message : String(error) }
  }

  // 404 и 410 — подписка мертва навсегда (RFC 8030 §7.3). Остальные
  // отказы — временные или наши собственные, подписку не трогаем.
  if (res.status === 404 || res.status === 410) return { kind: 'gone', status: res.status }
  if (res.status >= 200 && res.status < 300) return { kind: 'sent', status: res.status }

  const detail = (await res.text().catch(() => '')).slice(0, 300)
  return { kind: 'rejected', status: res.status, detail }
}
