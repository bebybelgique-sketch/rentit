import { describe, it, expect, vi } from 'vitest'
import {
  b64urlDecode,
  b64urlEncode,
  concat,
  encryptPayload,
  vapidAuthorization,
  isAllowedPushEndpoint,
  isValidTopic,
  sendWebPush,
  MAX_PLAINTEXT,
  RECORD_SIZE,
} from '../webPush'

/**
 * Шифрование Web Push — по эталону стандарта, а не «вроде работает».
 *
 * Все значения ниже взяты ДОСЛОВНО из RFC 8291, раздел 5 и приложение A
 * (https://www.rfc-editor.org/rfc/rfc8291.txt), с пробелами, как они там
 * записаны; декодер их снимает. Ключи, соль и ожидаемые байты — чужие:
 * если реализация ошибается хоть в одном байте, итог не совпадёт.
 *
 * Сверяется КАЖДАЯ ступень, а не только итог. Расхождение в конце без
 * этого выглядело бы как «что-то не так»; с этим оно называет место.
 */

const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV- JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',

  ecdhSecret: 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs',
  prkKey: 'Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k',
  keyInfo:
    'V2ViUHVzaDogaW5mbwAEJXGyvs3942BVG q8e0PTNNmwR zr5VX4m8t7GGpTM5FzFo7OLr4BhZe9MEebhuPI-OztV3 ' +
    'ylkYfpJGmQ22ggCLDgT-M_SrDepxkU21WCP3O1SUj0Ew bZIHMtu5pZpTKGSCIA5Zent7wmC6HCJ5mFgJkuk5cwAv MBKiiujwa7t45ewP',
  ikm: 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg',
  prk: '09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc',
  cek: 'oIhVW04MRdy2XN9CiKLxTg',
  nonce: '4h_95klXJ5E_qnoN',
  header:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml ' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT ' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

const bytes = (b64: string) => Array.from(b64urlDecode(b64))
const text = (u: Uint8Array) => new TextDecoder().decode(u)

const encryptRfc = () =>
  encryptPayload(
    b64urlDecode(RFC.plaintext),
    { p256dh: RFC.uaPublic.replace(/\s+/g, ''), auth: RFC.authSecret },
    { senderPrivate: RFC.asPrivate, senderPublic: RFC.asPublic.replace(/\s+/g, ''), salt: RFC.salt },
  )

describe('RFC 8291, пример из раздела 5 — по ступеням приложения A', () => {
  it('открытый текст — тот самый арбуз', () => {
    expect(text(b64urlDecode(RFC.plaintext))).toBe('When I grow up, I want to be a watermelon')
  })

  it('общий секрет ECDH', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.ecdhSecret)).toEqual(bytes(RFC.ecdhSecret))
  })

  it('ключ сочетания (PRK_key)', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.prkKey)).toEqual(bytes(RFC.prkKey))
  })

  it('info для сочетания (key_info)', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.keyInfo)).toEqual(bytes(RFC.keyInfo))
  })

  it('материал для ключа содержимого (IKM)', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.ikm)).toEqual(bytes(RFC.ikm))
  })

  it('PRK содержимого', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.prk)).toEqual(bytes(RFC.prk))
  })

  it('ключ шифрования (CEK) и nonce', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.cek)).toEqual(bytes(RFC.cek))
    expect(Array.from(trace.nonce)).toEqual(bytes(RFC.nonce))
  })

  it('заголовок — 86 байт: соль, размер записи 4096, ключ отправителя', async () => {
    const { trace } = await encryptRfc()
    expect(trace.header.length).toBe(86)
    expect(Array.from(trace.header)).toEqual(bytes(RFC.header))
  })

  it('шифротекст', async () => {
    const { trace } = await encryptRfc()
    expect(Array.from(trace.ciphertext)).toEqual(bytes(RFC.ciphertext))
  })

  /**
   * Итог — побайтно с телом запроса из раздела 5. 144 байта: в самом RFC
   * рядом стоит «Content-Length: 145», но тело в base64url декодируется
   * ровно в 144 = 86 заголовка + 41 текста + 1 разделитель + 16 метки.
   * Сверяем с телом, а не с опечаткой в заголовке примера.
   */
  it('всё тело запроса — побайтно', async () => {
    const { body } = await encryptRfc()
    expect(body.length).toBe(144)
    expect(Array.from(body)).toEqual(bytes(RFC.body))
  })
})

// ── Расшифровка со стороны браузера — другим путём ──────────────────
//
// Общий секрет здесь считается ОБРАТНО: закрытым ключом получателя и
// публичным ключом отправителя из заголовка. Код шифрования этого пути не
// проходит вовсе, поэтому совпадение — не сравнение функции с собой.

const enc = new TextEncoder()

const hmac = async (key: Uint8Array, data: Uint8Array) => {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

async function decryptAsBrowser(body: Uint8Array, uaPrivateJwk: JsonWebKey, uaPublic: Uint8Array, auth: Uint8Array) {
  const salt = body.slice(0, 16)
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ciphertext = body.slice(21 + idlen)

  const priv = await crypto.subtle.importKey('jwk', uaPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const pub = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256))

  const prkKey = await hmac(auth, ecdh)
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic)
  const ikm = (await hmac(prkKey, concat(keyInfo, new Uint8Array([1])))).slice(0, 32)
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0, 1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0, 1])))).slice(0, 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const record = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ciphertext))

  // Запись: текст · 0x02 · нули добивки. Снимаем с конца.
  let end = record.length
  while (end > 0 && record[end - 1] === 0) end--
  if (record[end - 1] !== 0x02) throw new Error('нет разделителя последней записи')
  return { plaintext: record.slice(0, end - 1), rs, idlen }
}

const newBrowserKeys = async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { publicKey, privateJwk, auth, p256dh: b64urlEncode(publicKey), authB64: b64urlEncode(auth) }
}

describe('браузер читает то, что зашифровал сервер', () => {
  it('эталон RFC расшифровывается закрытым ключом получателя', async () => {
    const uaPublic = b64urlDecode(RFC.uaPublic)
    const jwk: JsonWebKey = {
      kty: 'EC', crv: 'P-256',
      d: RFC.uaPrivate,
      x: b64urlEncode(uaPublic.slice(1, 33)),
      y: b64urlEncode(uaPublic.slice(33, 65)),
    }
    const { plaintext, rs } = await decryptAsBrowser(b64urlDecode(RFC.body), jwk, uaPublic, b64urlDecode(RFC.authSecret))
    expect(text(plaintext)).toBe('When I grow up, I want to be a watermelon')
    expect(rs).toBe(RECORD_SIZE)
  })

  it('случайные ключи: полный круг туда и обратно', async () => {
    const ua = await newBrowserKeys()
    const message = JSON.stringify({ title: 'Demande pour « Perceuse »', body: 'Julien V. · 24 → 26 sept.' })
    const { body } = await encryptPayload(enc.encode(message), { p256dh: ua.p256dh, auth: ua.authB64 })
    const { plaintext } = await decryptAsBrowser(body, ua.privateJwk, ua.publicKey, ua.auth)
    expect(text(plaintext)).toBe(message)
  })

  /**
   * Одноразовая пара ключей и соль — новые на каждое сообщение. Одинаковый
   * текст дважды не даёт одинаковых байт: перехвативший одно сообщение
   * ничего не узнаёт о другом, даже если текст совпал.
   */
  it('один и тот же текст дважды — разные байты', async () => {
    const ua = await newBrowserKeys()
    const a = await encryptPayload(enc.encode('x'), { p256dh: ua.p256dh, auth: ua.authB64 })
    const b = await encryptPayload(enc.encode('x'), { p256dh: ua.p256dh, auth: ua.authB64 })
    expect(b64urlEncode(a.body)).not.toBe(b64urlEncode(b.body))
  })

  it('текст больше предела отвергается до отправки, с понятной причиной', async () => {
    const ua = await newBrowserKeys()
    const big = new Uint8Array(MAX_PLAINTEXT + 1)
    await expect(encryptPayload(big, { p256dh: ua.p256dh, auth: ua.authB64 })).rejects.toThrow(/push_payload_too_large/)
  })

  it('ровно на пределе — тело укладывается в 4096 байт', async () => {
    const ua = await newBrowserKeys()
    const { body } = await encryptPayload(new Uint8Array(MAX_PLAINTEXT), { p256dh: ua.p256dh, auth: ua.authB64 })
    expect(body.length).toBe(4096)
  })

  it('кривые ключи подписки отвергаются', async () => {
    await expect(encryptPayload(enc.encode('x'), { p256dh: 'AAAA', auth: 'BTBZMqHH6r4Tts7J_aSIgg' })).rejects.toThrow(/push_bad_p256dh/)
    const ua = await newBrowserKeys()
    await expect(encryptPayload(enc.encode('x'), { p256dh: ua.p256dh, auth: 'AAAA' })).rejects.toThrow(/push_bad_auth/)
  })
})

// ── VAPID ───────────────────────────────────────────────────────────

const newVapid = async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    keys: { publicKey: b64urlEncode(publicRaw), privateKey: jwk.d as string, subject: 'mailto:test@example.org' },
    verifyKey: pair.publicKey,
  }
}

const parseVapid = (header: string) => {
  const m = header.match(/^vapid t=([^,]+), k=(.+)$/)
  if (!m) throw new Error(`не похоже на VAPID: ${header}`)
  const [h, c, s] = m[1].split('.')
  return {
    jwt: m[1],
    k: m[2],
    header: JSON.parse(text(b64urlDecode(h))),
    claims: JSON.parse(text(b64urlDecode(c))),
    signingInput: `${h}.${c}`,
    signature: b64urlDecode(s),
  }
}

describe('подпись VAPID', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'
  const now = Date.UTC(2026, 8, 22, 10, 0, 0)

  it('подпись проверяется публичным ключом сервера', async () => {
    const { keys, verifyKey } = await newVapid()
    const v = parseVapid(await vapidAuthorization(endpoint, keys, now))
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, verifyKey, v.signature, new TextEncoder().encode(v.signingInput),
    )
    expect(ok).toBe(true)
    // ES256 в JWS — это r||s, 64 байта, а не DER.
    expect(v.signature.length).toBe(64)
  })

  it('заявки: получатель — служба, срок — 12 часов, контакт — наш', async () => {
    const { keys } = await newVapid()
    const v = parseVapid(await vapidAuthorization(endpoint, keys, now))
    expect(v.header).toEqual({ typ: 'JWT', alg: 'ES256' })
    // aud — ТОЛЬКО origin службы, без пути: иначе Google отвечает 403.
    expect(v.claims.aud).toBe('https://fcm.googleapis.com')
    expect(v.claims.exp).toBe(now / 1000 + 12 * 3600)
    expect(v.claims.sub).toBe('mailto:test@example.org')
    expect(v.k).toBe(keys.publicKey)
  })

  it('RFC ограничивает срок сутками — мы внутри', async () => {
    const { keys } = await newVapid()
    const v = parseVapid(await vapidAuthorization(endpoint, keys, now))
    expect(v.claims.exp - now / 1000).toBeLessThanOrEqual(24 * 3600)
  })

  it('чужая пара — подпись НЕ проходит', async () => {
    const a = await newVapid()
    const b = await newVapid()
    const v = parseVapid(await vapidAuthorization(endpoint, a.keys, now))
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, b.verifyKey, v.signature, new TextEncoder().encode(v.signingInput),
    )
    expect(ok).toBe(false)
  })
})

// ── Куда разрешено слать ────────────────────────────────────────────

describe('адрес подписки: только службы уведомлений браузеров', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://android.googleapis.com/gcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGuQyavXuto',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('принимается: %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true)
  })

  /**
   * Адрес приходит ОТ КЛИЕНТА, а сервер шлёт на него запросы. Без этого
   * ограничения — готовый SSRF.
   */
  it.each([
    ['http, не https', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['внутренний адрес', 'https://169.254.169.254/latest/meta-data'],
    ['свой сервер', 'https://evil.example.com/push'],
    ['подделка поддомена', 'https://fcm.googleapis.com.evil.com/x'],
    ['хвост после windows', 'https://x.notify.windows.com.evil.com/x'],
    ['учётка в адресе', 'https://user:pass@fcm.googleapis.com/x'],
    ['мусор', 'не адрес'],
  ])('отвергается: %s', (_why, url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false)
  })
})

describe('тема сообщения', () => {
  it('id брони без дефисов — ровно 32 знака, годится', () => {
    expect(isValidTopic('3f2c9a1b8e7d4c6fa0b1c2d3e4f5a6b7')).toBe(true)
  })
  it('с дефисами длиннее 32 — нет', () => {
    expect(isValidTopic('3f2c9a1b-8e7d-4c6f-a0b1-c2d3e4f5a6b7')).toBe(false)
  })
})

// ── Отправка ────────────────────────────────────────────────────────

describe('отправка и разбор ответа службы', () => {
  const setup = async () => ({ ua: await newBrowserKeys(), vapid: (await newVapid()).keys })

  const target = (ua: Awaited<ReturnType<typeof newBrowserKeys>>) => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: ua.p256dh,
    auth: ua.authB64,
  })

  it('201 — принято; заголовки и тело по стандарту', async () => {
    const { ua, vapid } = await setup()
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }))
    const payload = { title: 'T', body: 'B', tag: 'booking-1', url: '/my-rentals?booking=1' }

    const outcome = await sendWebPush(target(ua), payload, vapid, {
      ttl: 86400, urgency: 'high', topic: 'abc', fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(outcome).toEqual({ kind: 'sent', status: 201 })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc')
    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers.TTL).toBe('86400')
    expect(headers.Urgency).toBe('high')
    expect(headers.Topic).toBe('abc')
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=.+$/)

    // Тело читается браузером — это и есть проверка, что ушло не мусор.
    const { plaintext } = await decryptAsBrowser(new Uint8Array(init.body as ArrayBuffer), ua.privateJwk, ua.publicKey, ua.auth)
    expect(JSON.parse(text(plaintext))).toEqual(payload)
  })

  it.each([404, 410])('%i — подписки больше нет', async (status) => {
    const { ua, vapid } = await setup()
    const fetchImpl = vi.fn(async () => new Response(null, { status }))
    const outcome = await sendWebPush(target(ua), {}, vapid, {
      ttl: 60, urgency: 'normal', fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(outcome).toEqual({ kind: 'gone', status })
  })

  it('429 — отказ, но подписка жива', async () => {
    const { ua, vapid } = await setup()
    const fetchImpl = vi.fn(async () => new Response('slow down', { status: 429 }))
    const outcome = await sendWebPush(target(ua), {}, vapid, {
      ttl: 60, urgency: 'normal', fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(outcome).toEqual({ kind: 'rejected', status: 429, detail: 'slow down' })
  })

  it('обрыв сети — отдельный исход, не исключение', async () => {
    const { ua, vapid } = await setup()
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET') })
    const outcome = await sendWebPush(target(ua), {}, vapid, {
      ttl: 60, urgency: 'normal', fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(outcome).toEqual({ kind: 'network', detail: 'ECONNRESET' })
  })

  it('чужой адрес — отказ БЕЗ запроса наружу', async () => {
    const { ua, vapid } = await setup()
    const fetchImpl = vi.fn()
    const outcome = await sendWebPush(
      { ...target(ua), endpoint: 'https://169.254.169.254/x' }, {}, vapid,
      { ttl: 60, urgency: 'normal', fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(outcome).toEqual({ kind: 'rejected', status: 0, detail: 'push_endpoint_unsupported' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('кривая тема — отказ без запроса', async () => {
    const { ua, vapid } = await setup()
    const fetchImpl = vi.fn()
    const outcome = await sendWebPush(target(ua), {}, vapid, {
      ttl: 60, urgency: 'normal', topic: 'с пробелом и кириллицей', fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(outcome.kind).toBe('rejected')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
