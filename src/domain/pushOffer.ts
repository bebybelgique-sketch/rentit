// src/domain/pushOffer.ts
//
// Когда предлагать уведомления, когда молчать и что показать в Профиле.
//
// Правила — из пакета Claude Design «Rentit Push Permission» (21.09).
// Здесь они записаны ФУНКЦИЯМИ без браузера: всё, что знает эта часть, —
// факты на входе и решение на выходе. Браузер читает src/lib/push.ts.
//
// ── ГЛАВНОЕ ─────────────────────────────────────────────────────────
//
// Браузер задаёт вопрос о разрешении ОДИН раз. Отказ в его окне почти
// необратим: вернуть разрешение человек может только сам, через
// настройки сайта, и почти никто этого не делает. Поэтому окно браузера
// открывается только после «да» в НАШЕЙ карточке, а карточка появляется
// только тогда, когда у человека есть конкретная причина ждать ответа:
// он только что отправил заявку (карточка A) или выставил вещь (B).
//
// «Не сейчас» вопрос браузера не тратит. Предложим снова при следующем
// поводе, но не раньше чем через 7 дней; после двух «не сейчас» —
// молчим совсем. Строка в Профиле остаётся всегда.

/** Что умеет этот браузер. */
export type PushCapability =
  /** Service worker, PushManager и Notification на месте. */
  | 'supported'
  /**
   * iPhone или iPad в Safari, а не с экрана «Домой». Push на iOS
   * доступен только приложению, добавленному на экран (iOS 16.4+):
   * вместо кнопки «Me prévenir» — объяснение, как добавить (карточка D).
   */
  | 'ios-needs-install'
  /** Push здесь нет вовсе: ни карточек, ни строки в Профиле. */
  | 'unsupported'

export type PushPermission = 'default' | 'granted' | 'denied'

/** Что браузер рассказал о себе. Собирает src/lib/push.ts. */
export interface PushEnvironment {
  readonly userAgent: string
  readonly platform: string
  readonly maxTouchPoints: number
  /** Открыто с экрана «Домой» (display-mode: standalone). */
  readonly standalone: boolean
  readonly hasServiceWorker: boolean
  readonly hasPushManager: boolean
  readonly hasNotification: boolean
}

/** Версия iOS из строки браузера, если её можно прочесть. */
export function iosVersion(userAgent: string): readonly [number, number] | null {
  // iPhone: «CPU iPhone OS 16_4 like Mac OS X».
  const os = /OS (\d+)[_.](\d+)/.exec(userAgent)
  if (os && /iPhone|iPad|iPod/.test(userAgent)) return [Number(os[1]), Number(os[2])]
  // iPad с iPadOS 13+ представляется Маком: версию несёт «Version/16.4».
  const version = /Version\/(\d+)\.(\d+)/.exec(userAgent)
  if (version) return [Number(version[1]), Number(version[2])]
  return null
}

const isAppleTouch = (env: PushEnvironment): boolean =>
  /iPad|iPhone|iPod/.test(env.userAgent) ||
  // iPadOS 13+ в Safari выдаёт себя за Мак — отличает его сенсорный экран.
  (env.platform === 'MacIntel' && env.maxTouchPoints > 1)

/** iOS 16.4 — первая версия, где push есть у приложений с экрана «Домой». */
const IOS_PUSH_SINCE: readonly [number, number] = [16, 4]

const atLeast = (v: readonly [number, number], min: readonly [number, number]): boolean =>
  v[0] > min[0] || (v[0] === min[0] && v[1] >= min[1])

export function detectCapability(env: PushEnvironment): PushCapability {
  if (!env.hasServiceWorker) return 'unsupported'

  if (isAppleTouch(env) && !env.standalone) {
    // Версию прочесть не удалось — считаем свежей: устройства старше
    // iOS 16.4 в 2026 году редкость, и лишнее объяснение «добавьте на
    // экран» обходится дешевле, чем молчание перед тем, кому оно помогло бы.
    const version = iosVersion(env.userAgent)
    return version === null || atLeast(version, IOS_PUSH_SINCE) ? 'ios-needs-install' : 'unsupported'
  }

  if (!env.hasPushManager || !env.hasNotification) return 'unsupported'
  return 'supported'
}

// ── Память об отказах ───────────────────────────────────────────────

/** Сколько ждать после «не сейчас» до следующего предложения. */
export const REOFFER_AFTER_MS = 7 * 24 * 3600 * 1000
/** После скольких «не сейчас» карточки больше не показываются. */
export const MAX_DISMISSALS = 2

/**
 * Что этот браузер помнит о прошлых ответах. Хранится в localStorage —
 * пакет Design считает этого достаточным, и это верно: разрешение браузера
 * тоже живёт на устройстве, а не в учётке.
 */
export interface OfferMemory {
  readonly dismissedCount: number
  /** Миллисекунды эпохи последнего «не сейчас». */
  readonly dismissedAt: number | null
  /**
   * Человек сам выключил уведомления в Профиле. Разрешение браузера при
   * этом остаётся, и без этой отметки правило «разрешение есть, подписки
   * нет — подписать молча» включило бы их обратно при следующем заходе.
   */
  readonly optedOut: boolean
  /** Полоса C закрыта кнопкой «Compris» — навсегда. */
  readonly blockedBannerDismissed: boolean
}

export const EMPTY_MEMORY: OfferMemory = {
  dismissedCount: 0,
  dismissedAt: null,
  optedOut: false,
  blockedBannerDismissed: false,
}

export function recordDismissal(memory: OfferMemory, now: number): OfferMemory {
  return { ...memory, dismissedCount: memory.dismissedCount + 1, dismissedAt: now }
}

// ── Решения ─────────────────────────────────────────────────────────

/** Факты, из которых складывается решение. */
export interface PushDeviceFacts {
  readonly capability: PushCapability
  /**
   * Канал заведён на сервере (есть ключи VAPID). Пока нет — продукт
   * уведомлений не предлагает вовсе: обещать то, что не придёт, нельзя.
   */
  readonly configured: boolean
  readonly permission: PushPermission
  /** Сервер знает подписку ЭТОГО устройства за ЭТИМ человеком. */
  readonly subscribed: boolean
}

export type OfferDecision =
  /** Ничего не показывать. */
  | 'none'
  /** Карточка A или B: «Me prévenir» / «Pas maintenant». */
  | 'ask'
  /** Карточка D: как добавить RentIt на экран «Домой». */
  | 'install'
  /**
   * Разрешение уже дано, а подписки на этом устройстве нет — подписать
   * без карточки. Спрашивать о том, на что человек уже ответил «да»,
   * значит заставлять его отвечать дважды.
   */
  | 'subscribe-silently'

/** Решение на поводе: заявка отправлена (A) или вещь выставлена (B). */
export function decideOffer(facts: PushDeviceFacts, memory: OfferMemory, now: number): OfferDecision {
  if (facts.capability === 'unsupported' || !facts.configured) return 'none'
  // Выключил сам — не уговариваем. Включить обратно можно в Профиле.
  if (memory.optedOut) return 'none'

  const quiet =
    memory.dismissedCount >= MAX_DISMISSALS ||
    (memory.dismissedAt !== null && now - memory.dismissedAt < REOFFER_AFTER_MS)

  if (facts.capability === 'ios-needs-install') return quiet ? 'none' : 'install'

  // Отказ в окне браузера: переспросить нельзя технически, а карточка
  // без действия — упрёк. Об этом состоянии говорит полоса C.
  if (facts.permission === 'denied') return 'none'
  if (facts.permission === 'granted') return facts.subscribed ? 'none' : 'subscribe-silently'

  return quiet ? 'none' : 'ask'
}

/**
 * Полоса C в «Locations»: уведомления заблокированы в браузере, а ответа
 * человек как раз ждёт. Показывается, пока её не закрыли «Compris».
 */
export function shouldShowBlockedBanner(
  facts: PushDeviceFacts,
  memory: OfferMemory,
  hasPendingRequest: boolean,
): boolean {
  return (
    facts.capability === 'supported' &&
    facts.configured &&
    facts.permission === 'denied' &&
    hasPendingRequest &&
    !memory.blockedBannerDismissed
  )
}

/** Строка «Notifications» в Профиле (F). */
export type PushRowState =
  /** Push недоступен или не заведён — строки нет. */
  | 'hidden'
  /** «Désactivées sur cet appareil» + «Activer». */
  | 'off'
  /** «Activées sur cet appareil» + «Désactiver». */
  | 'on'
  /** Заблокированы в браузере: только объяснение, как вернуть. */
  | 'blocked'
  /** iPhone не с экрана «Домой»: только объяснение. */
  | 'install'

export function profileRowState(facts: PushDeviceFacts): PushRowState {
  if (facts.capability === 'unsupported' || !facts.configured) return 'hidden'
  if (facts.capability === 'ios-needs-install') return 'install'
  if (facts.permission === 'denied') return 'blocked'
  if (facts.permission === 'granted' && facts.subscribed) return 'on'
  return 'off'
}
