import { describe, it, expect } from 'vitest'
import {
  EMPTY_MEMORY,
  MAX_DISMISSALS,
  REOFFER_AFTER_MS,
  decideOffer,
  detectCapability,
  iosVersion,
  profileRowState,
  recordDismissal,
  shouldShowBlockedBanner,
  type PushDeviceFacts,
  type PushEnvironment,
} from '../pushOffer'

/**
 * Правила пакета Design «Rentit Push Permission» — каждое своей проверкой.
 * Если какую-то из них понадобится переписать, это смена решения пакета,
 * а не правка теста.
 */

const CHROME: PushEnvironment = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
}
const IPHONE_SAFARI: PushEnvironment = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  // В Safari вне экрана «Домой» PushManager нет вовсе.
  hasPushManager: false,
  hasNotification: false,
}
const IPAD_AS_MAC: PushEnvironment = {
  ...IPHONE_SAFARI,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15',
  platform: 'MacIntel',
}

const NOW = Date.UTC(2026, 8, 23, 12)
const READY: PushDeviceFacts = { capability: 'supported', configured: true, permission: 'default', subscribed: false }

describe('что умеет браузер', () => {
  it('обычный Chrome — поддерживается', () => {
    expect(detectCapability(CHROME)).toBe('supported')
  })

  it('без PushManager — не поддерживается: ни карточек, ни строки', () => {
    expect(detectCapability({ ...CHROME, hasPushManager: false })).toBe('unsupported')
    expect(detectCapability({ ...CHROME, hasServiceWorker: false })).toBe('unsupported')
  })

  it('iPhone в Safari — карточка D вместо A/B', () => {
    expect(detectCapability(IPHONE_SAFARI)).toBe('ios-needs-install')
  })

  it('iPadOS, выдающий себя за Мак, распознаётся по сенсорному экрану', () => {
    expect(detectCapability(IPAD_AS_MAC)).toBe('ios-needs-install')
    // Настоящий Мак без сенсорного экрана — обычный браузер.
    expect(detectCapability({ ...IPAD_AS_MAC, maxTouchPoints: 0, hasPushManager: true, hasNotification: true })).toBe('supported')
  })

  it('iPhone с экрана «Домой» — поддерживается', () => {
    expect(detectCapability({ ...IPHONE_SAFARI, standalone: true, hasPushManager: true, hasNotification: true })).toBe('supported')
  })

  it('iOS старше 16.4 — не поддерживается: добавление на экран не поможет', () => {
    const old = { ...IPHONE_SAFARI, userAgent: IPHONE_SAFARI.userAgent.replace('17_5', '16_3').replace('Version/17.5', 'Version/16.3') }
    expect(detectCapability(old)).toBe('unsupported')
    const edge = { ...IPHONE_SAFARI, userAgent: IPHONE_SAFARI.userAgent.replace('17_5', '16_4') }
    expect(detectCapability(edge)).toBe('ios-needs-install')
  })

  it('версия iOS читается и из «OS 17_5», и из «Version/17.4»', () => {
    expect(iosVersion(IPHONE_SAFARI.userAgent)).toEqual([17, 5])
    expect(iosVersion(IPAD_AS_MAC.userAgent)).toEqual([17, 4])
    expect(iosVersion('нечитаемо')).toBeNull()
  })
})

describe('когда предлагать', () => {
  it('первый повод, разрешение не спрашивали — карточка', () => {
    expect(decideOffer(READY, EMPTY_MEMORY, NOW)).toBe('ask')
  })

  it('канал не заведён на сервере — ничего не обещаем', () => {
    expect(decideOffer({ ...READY, configured: false }, EMPTY_MEMORY, NOW)).toBe('none')
    expect(decideOffer({ ...READY, capability: 'ios-needs-install', configured: false }, EMPTY_MEMORY, NOW)).toBe('none')
  })

  it('разрешение уже есть, подписки нет — подписать молча, без карточки', () => {
    expect(decideOffer({ ...READY, permission: 'granted' }, EMPTY_MEMORY, NOW)).toBe('subscribe-silently')
  })

  it('разрешение есть и подписка есть — ничего', () => {
    expect(decideOffer({ ...READY, permission: 'granted', subscribed: true }, EMPTY_MEMORY, NOW)).toBe('none')
  })

  it('отказ в окне браузера — карточек больше нет никогда', () => {
    expect(decideOffer({ ...READY, permission: 'denied' }, EMPTY_MEMORY, NOW)).toBe('none')
  })

  it('«не сейчас» — не раньше чем через 7 дней', () => {
    const once = recordDismissal(EMPTY_MEMORY, NOW)
    expect(decideOffer(READY, once, NOW + REOFFER_AFTER_MS - 1)).toBe('none')
    expect(decideOffer(READY, once, NOW + REOFFER_AFTER_MS)).toBe('ask')
  })

  it('после двух «не сейчас» — молчим совсем, сколько бы ни прошло', () => {
    const twice = recordDismissal(recordDismissal(EMPTY_MEMORY, NOW - 30 * REOFFER_AFTER_MS), NOW - 20 * REOFFER_AFTER_MS)
    expect(twice.dismissedCount).toBe(MAX_DISMISSALS)
    expect(decideOffer(READY, twice, NOW)).toBe('none')
  })

  it('выключил сам в Профиле — не уговариваем и молча не включаем', () => {
    const optedOut = { ...EMPTY_MEMORY, optedOut: true }
    expect(decideOffer(READY, optedOut, NOW)).toBe('none')
    expect(decideOffer({ ...READY, permission: 'granted' }, optedOut, NOW)).toBe('none')
  })

  it('iPhone вне экрана «Домой» — карточка D по тем же правилам отказов', () => {
    const ios = { ...READY, capability: 'ios-needs-install' as const }
    expect(decideOffer(ios, EMPTY_MEMORY, NOW)).toBe('install')
    expect(decideOffer(ios, recordDismissal(EMPTY_MEMORY, NOW), NOW + 1000)).toBe('none')
  })
})

describe('полоса C в «Locations»', () => {
  const denied = { ...READY, permission: 'denied' as const }

  it('заблокировано и ответа ждут — показать', () => {
    expect(shouldShowBlockedBanner(denied, EMPTY_MEMORY, true)).toBe(true)
  })

  it('ждать нечего — не показывать', () => {
    expect(shouldShowBlockedBanner(denied, EMPTY_MEMORY, false)).toBe(false)
  })

  it('«Compris» закрывает навсегда', () => {
    expect(shouldShowBlockedBanner(denied, { ...EMPTY_MEMORY, blockedBannerDismissed: true }, true)).toBe(false)
  })

  it('не заблокировано — не показывать', () => {
    expect(shouldShowBlockedBanner(READY, EMPTY_MEMORY, true)).toBe(false)
  })
})

describe('строка в Профиле', () => {
  it('все пять состояний', () => {
    expect(profileRowState(READY)).toBe('off')
    expect(profileRowState({ ...READY, permission: 'granted', subscribed: true })).toBe('on')
    // Разрешение есть, подписку сняли «Désactiver» — снова «Activer».
    expect(profileRowState({ ...READY, permission: 'granted' })).toBe('off')
    expect(profileRowState({ ...READY, permission: 'denied' })).toBe('blocked')
    expect(profileRowState({ ...READY, capability: 'ios-needs-install' })).toBe('install')
    expect(profileRowState({ ...READY, capability: 'unsupported' })).toBe('hidden')
    expect(profileRowState({ ...READY, configured: false })).toBe('hidden')
  })
})
