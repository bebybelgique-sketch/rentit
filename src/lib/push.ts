// src/lib/push.ts
//
// Push-уведомления на стороне браузера: разрешение, подписка устройства и
// её снятие. Что и когда предлагать, решает src/domain/pushOffer.ts; здесь
// только то, что трогает браузер и сервер.
//
// ── КУДА ИДЁТ ПОДПИСКА ───────────────────────────────────────────────
//
// Таблица подписок закрыта для клиента целиком (миграция 40): адрес
// подписки — ключ, по которому человеку можно слать сообщения. Всё идёт
// через функцию push-subscription, и каждая операция — только над
// подпиской ЭТОГО устройства у ЭТОГО человека.
//
// ── ПОЧЕМУ ВСЁ ЗДЕСЬ НЕ БРОСАЕТ В ТИШИНЕ ─────────────────────────────
//
// Отказ — исключение EdgeError с кодом, как у остальных функций: текст
// подбирает экран по языку человека (src/domain/serverErrors.ts). Молча
// глотается только то, где человеку сказать нечего: подписка «в фоне» при
// входе и снятие устройства при выходе.

import { EdgeError, invokeEdge } from './edgeInvoke'
import { b64urlDecode, isPushLang, type PushLang } from '../domain/push'
import {
  EMPTY_MEMORY,
  type OfferMemory,
  type PushEnvironment,
  type PushPermission,
} from '../domain/pushOffer'

const FN = 'push-subscription'

// ── Что умеет браузер ───────────────────────────────────────────────

export function readEnvironment(): PushEnvironment {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const win = typeof window === 'undefined' ? undefined : window
  let standalone = false
  try {
    standalone =
      Boolean(win?.matchMedia?.('(display-mode: standalone)').matches) ||
      // Safari на iOS отдаёт это отдельным свойством.
      (nav as (Navigator & { standalone?: boolean }) | undefined)?.standalone === true
  } catch {
    /* matchMedia может не быть */
  }
  return {
    userAgent: nav?.userAgent ?? '',
    platform: nav?.platform ?? '',
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone,
    hasServiceWorker: Boolean(nav && 'serviceWorker' in nav),
    hasPushManager: Boolean(win && 'PushManager' in win),
    hasNotification: Boolean(win && 'Notification' in win),
  }
}

export function readPermission(): PushPermission {
  try {
    if (typeof Notification === 'undefined') return 'default'
    const p = Notification.permission
    return p === 'granted' || p === 'denied' ? p : 'default'
  } catch {
    return 'default'
  }
}

/** Язык уведомлений — язык приложения на этом устройстве. */
export const pushLangOf = (language: string | undefined): PushLang => {
  const short = (language ?? '').slice(0, 2)
  return isPushLang(short) ? short : 'fr'
}

// ── Память об отказах (localStorage) ────────────────────────────────
//
// Имена ключей — из пакета Design. Любое чтение и запись обёрнуты: в
// приватном режиме хранилище бросает, а уведомления — не повод ронять
// экран заявки.

const KEYS = {
  count: 'push_dismissed_count',
  at: 'push_dismissed_at',
  optedOut: 'push_opted_out',
  banner: 'push_blocked_banner_dismissed',
} as const

export function readOfferMemory(): OfferMemory {
  try {
    const count = Number(localStorage.getItem(KEYS.count))
    const at = Number(localStorage.getItem(KEYS.at))
    return {
      dismissedCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
      dismissedAt: Number.isFinite(at) && at > 0 ? at : null,
      optedOut: localStorage.getItem(KEYS.optedOut) === '1',
      blockedBannerDismissed: localStorage.getItem(KEYS.banner) === '1',
    }
  } catch {
    return EMPTY_MEMORY
  }
}

export function writeOfferMemory(memory: OfferMemory): void {
  try {
    localStorage.setItem(KEYS.count, String(memory.dismissedCount))
    if (memory.dismissedAt === null) localStorage.removeItem(KEYS.at)
    else localStorage.setItem(KEYS.at, String(memory.dismissedAt))
    if (memory.optedOut) localStorage.setItem(KEYS.optedOut, '1')
    else localStorage.removeItem(KEYS.optedOut)
    if (memory.blockedBannerDismissed) localStorage.setItem(KEYS.banner, '1')
    else localStorage.removeItem(KEYS.banner)
  } catch {
    /* приватный режим: переживём без памяти */
  }
}

// ── Сервер ──────────────────────────────────────────────────────────

let publicKey: Promise<string | null> | null = null

/**
 * Публичный ключ VAPID. `null` — канал не заведён (503 push_not_configured):
 * это состояние продукта, а не сбой, и оно запоминается на сеанс. Любой
 * другой отказ не запоминается — следующий вызов спросит снова.
 */
export function fetchPublicKey(): Promise<string | null> {
  publicKey ??= invokeEdge<{ publicKey?: string }>(FN, { action: 'config' })
    .then((r) => (typeof r.publicKey === 'string' && r.publicKey ? r.publicKey : null))
    .catch((error: unknown) => {
      if (error instanceof EdgeError && error.code === 'push_not_configured') return null
      publicKey = null
      throw error
    })
  return publicKey
}

/** Только для тестов: сбросить запомненный ключ. */
export function forgetPublicKeyForTests(): void {
  publicKey = null
}

async function serverKnows(endpoint: string): Promise<boolean> {
  const r = await invokeEdge<{ subscribed?: boolean }>(FN, { action: 'status', endpoint })
  return r.subscribed === true
}

// ── Воркер и подписка устройства ────────────────────────────────────

const timeout = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

/**
 * Регистрация воркера с АКТИВНЫМ воркером — без него подписаться нельзя.
 *
 * `ready` не разрешается вовсе, если воркер не ставился (так в `vite dev`),
 * поэтому ожидание ограничено: лучше честное «не поддерживается», чем
 * вечная карточка с крутящейся кнопкой.
 */
export async function pushRegistration(waitMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing?.active) return existing
    return await Promise.race([navigator.serviceWorker.ready, timeout(waitMs, null)])
  } catch {
    return null
  }
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Подписка этого устройства и её запись на сервере.
 *
 * Если устройство уже подписано ДРУГИМ ключом (ключи VAPID сменили),
 * старая подписка снимается: сервер больше не может её подписать, и
 * уведомления по ней не пришли бы никогда.
 */
export async function subscribeThisDevice(lang: PushLang): Promise<void> {
  const key = await fetchPublicKey()
  if (!key) throw new EdgeError('push_not_configured', 503)

  const registration = await pushRegistration()
  if (!registration) throw new EdgeError('push_unsupported')

  const keyBytes = b64urlDecode(key)
  let subscription = await registration.pushManager.getSubscription()
  const current = subscription?.options.applicationServerKey
  if (subscription && current && !bytesEqual(new Uint8Array(current), keyBytes)) {
    await subscription.unsubscribe().catch(() => false)
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({
    // Каждое сообщение обязано стать видимым уведомлением — так требует
    // Chrome, и так обещано человеку: «rien d'autre».
    userVisibleOnly: true,
    applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
  })

  const json = subscription.toJSON()
  await invokeEdge(FN, {
    action: 'subscribe',
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    lang,
  })
}

/** Подписка этого устройства, если она есть. */
export async function localSubscription(waitMs?: number): Promise<PushSubscription | null> {
  const registration = await pushRegistration(waitMs)
  if (!registration) return null
  try {
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** Знает ли сервер подписку этого устройства за вошедшим человеком. */
export async function isThisDeviceSubscribed(): Promise<boolean> {
  const subscription = await localSubscription()
  return subscription ? serverKnows(subscription.endpoint) : false
}

/**
 * «Désactiver» в Профиле: снять на сервере, потом в браузере.
 *
 * Порядок не случаен. Если сервер не ответил, исключение уходит к экрану,
 * а подписка остаётся целой с обеих сторон — состояние честное, человек
 * видит «не получилось» и пробует снова. Обратный порядок оставил бы на
 * сервере адрес, который уже никуда не ведёт.
 */
export async function unsubscribeThisDevice(): Promise<void> {
  const subscription = await localSubscription()
  if (!subscription) return
  await invokeEdge(FN, { action: 'unsubscribe', endpoint: subscription.endpoint })
  await subscription.unsubscribe().catch(() => false)
}

/**
 * Выход из учётки: устройство перестаёт получать её уведомления.
 *
 * Звать ДО `signOut`: после него запрос уйдёт без ключа входа и сервер
 * ответит 401. Выход не ждёт больше пары секунд и не падает никогда —
 * человек нажал «выйти» и обязан выйти. Если сервер не ответил, подписка
 * снимается хотя бы в браузере: служба уведомлений ответит серверу 410 на
 * следующую отправку, и тот удалит адрес сам.
 */
export async function releaseThisDevice(): Promise<void> {
  try {
    const subscription = await localSubscription(1000)
    if (!subscription) return
    await Promise.race([
      invokeEdge(FN, { action: 'unsubscribe', endpoint: subscription.endpoint }).catch(() => null),
      timeout(2500, null),
    ])
    await subscription.unsubscribe().catch(() => false)
  } catch {
    /* выход важнее */
  }
}

/** Язык сменился — уведомления на этом устройстве пойдут на новом. */
export async function syncDeviceLanguage(lang: PushLang): Promise<void> {
  const subscription = await localSubscription(1000)
  if (!subscription) return
  await invokeEdge(FN, { action: 'lang', endpoint: subscription.endpoint, lang })
}

/**
 * Сообщение отправлено — пусть собеседник узнает.
 *
 * Ничего не ждёт и ничего не роняет: сообщение уже записано, и отказ
 * уведомления не повод говорить человеку, что отправка не удалась.
 * Повторный вызов о том же сообщении сервер отбрасывает сам.
 */
export function notifyMessageSent(messageId: string): void {
  invokeEdge('notify-message', { message_id: messageId }).catch((error: unknown) => {
    console.warn('[push] notify-message:', error instanceof EdgeError ? error.code : error)
  })
}
