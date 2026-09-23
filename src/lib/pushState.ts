// src/lib/pushState.ts
//
// Состояние уведомлений на этом устройстве — одно на всё приложение.
//
// ЗАЧЕМ ОБЩЕЕ. Одно и то же состояние видно в трёх местах: карточка на
// экране заявки, полоса в «Locations», строка в Профиле. Спрашивай каждый
// сам — три запроса к серверу на одно и то же, и три ответа, которые могут
// разойтись: карточка скажет «активировано», а Профиль — «выключено».
//
// ПОЧЕМУ НЕ react-query. Страницы, где это показывается, проверяются
// тестами без QueryClientProvider (хуки данных подменяются поимённо), и
// новый запрос там остался бы без клиента. Маленькое хранилище с
// useSyncExternalStore провайдера не требует.

import {
  detectCapability,
  type PushCapability,
  type PushPermission,
} from '../domain/pushOffer'
import type { PushLang } from '../domain/push'
import {
  fetchPublicKey,
  isThisDeviceSubscribed,
  readEnvironment,
  readOfferMemory,
  readPermission,
  subscribeThisDevice,
  unsubscribeThisDevice,
  writeOfferMemory,
} from './push'

export interface PushSnapshot {
  /** idle — ещё не выясняли; probing — выясняем; ready — известно. */
  readonly phase: 'idle' | 'probing' | 'ready'
  readonly capability: PushCapability
  readonly configured: boolean
  readonly permission: PushPermission
  readonly subscribed: boolean
}

const initial = (): PushSnapshot => ({
  phase: 'idle',
  capability: detectCapability(readEnvironment()),
  configured: false,
  permission: readPermission(),
  subscribed: false,
})

let snapshot: PushSnapshot = initial()
const listeners = new Set<() => void>()
/**
 * Поколение состояния. Выход из учётки начинает новое: выяснение,
 * начатое ДО выхода, не имеет права записать чужую подписку в состояние
 * следующего человека.
 */
let generation = 0

const set = (next: PushSnapshot) => {
  snapshot = next
  listeners.forEach((listener) => listener())
}

export const getPushSnapshot = (): PushSnapshot => snapshot

export function subscribePushState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let probing: Promise<void> | null = null
let watchingPermission = false

/**
 * Разрешение меняют и мимо нас — в настройках сайта. Браузеры, которые
 * умеют об этом сообщать, сообщают; остальные увидят перемену при
 * следующем выяснении.
 */
function watchPermission(): void {
  if (watchingPermission) return
  watchingPermission = true
  try {
    void navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((status) => {
        status.onchange = () => set({ ...snapshot, permission: readPermission() })
      })
      .catch(() => {})
  } catch {
    /* permissions API нет — не беда */
  }
}

/**
 * Выяснить состояние: заведён ли канал, есть ли подписка у этого
 * устройства. Сеть трогается, только если push здесь вообще возможен;
 * без него — ни одного запроса.
 */
export function probePush(): Promise<void> {
  if (probing) return probing
  const mine = generation
  probing = (async () => {
    const capability = detectCapability(readEnvironment())
    if (capability === 'unsupported') {
      set({ phase: 'ready', capability, configured: false, permission: readPermission(), subscribed: false })
      return
    }
    set({ ...snapshot, phase: 'probing', capability })
    watchPermission()

    let configured = false
    try {
      configured = (await fetchPublicKey()) !== null
    } catch {
      configured = false
    }

    let subscribed = false
    if (configured && capability === 'supported') {
      try {
        subscribed = await isThisDeviceSubscribed()
      } catch {
        subscribed = false
      }
    }

    if (mine !== generation) return
    set({ phase: 'ready', capability, configured, permission: readPermission(), subscribed })
  })().finally(() => {
    probing = null
  })
  return probing
}

/** Выход из учётки: всё, что знали, относилось к прежнему человеку. */
export function resetPushState(): void {
  generation++
  probing = null
  set(initial())
}

export type EnableOutcome = 'granted' | 'denied' | 'dismissed'

/**
 * «Me prévenir» и «Activer».
 *
 * Окно браузера открывается ТОЛЬКО здесь — по нажатию человека. Если
 * разрешение уже есть (человек выключал уведомления в Профиле), окна не
 * будет: браузер ответил раньше, спрашивать повторно нечего.
 *
 * Отказ подписки (сеть, сервер) — исключение: экран покажет его текстом.
 */
export async function enablePush(lang: PushLang): Promise<EnableOutcome> {
  let permission = readPermission()
  if (permission !== 'granted') {
    permission = (await Notification.requestPermission()) as PushPermission
  }
  if (permission !== 'granted') {
    set({ ...snapshot, permission: readPermission() })
    return permission === 'denied' ? 'denied' : 'dismissed'
  }

  await subscribeThisDevice(lang)
  writeOfferMemory({ ...readOfferMemory(), optedOut: false })
  set({ ...snapshot, phase: 'ready', permission: 'granted', subscribed: true })
  return 'granted'
}

/** «Désactiver»: подписка снята, и молча она не вернётся. */
export async function disablePush(): Promise<void> {
  await unsubscribeThisDevice()
  writeOfferMemory({ ...readOfferMemory(), optedOut: true })
  set({ ...snapshot, subscribed: false })
}

/**
 * Разрешение есть, подписки нет — подписать без вопросов (правило пакета).
 * Так бывает после выхода и нового входа, после чистки данных сайта или
 * когда браузер сам сменил адрес подписки. Отказ не показывается: человек
 * ничего не нажимал, и сообщать ему не о чем.
 */
export async function subscribeSilently(lang: PushLang): Promise<void> {
  if (readPermission() !== 'granted' || readOfferMemory().optedOut) return
  try {
    await subscribeThisDevice(lang)
    set({ ...snapshot, subscribed: true })
  } catch (error) {
    console.warn('[push] тихая подписка не удалась:', error)
  }
}
