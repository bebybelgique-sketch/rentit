// src/lib/usage.ts
//
// Дневные счётчики: сколько раз сегодня случилось событие — и всё.
//
// ── ЗАЧЕМ ────────────────────────────────────────────────────────────
//
// Первый экран развёрнут к поиску (#170), а сколько людей открывает
// главную, ищет, упирается в пустую выдачу и начинает выкладку, не знал
// никто: счётчиков в продукте не было ни одного. Таблица — usage_counts,
// миграция 62: день, событие, число. Ни кто, ни откуда, ни что искал.
//
// ── ТОЛЬКО С СОГЛАСИЕМ ───────────────────────────────────────────────
//
// Баннер спрашивает «Analytique — Statistiques anonymes d'utilisation».
// Событие уходит, только если человек это включил. Пока он не выбрал,
// события ждут в памяти вкладки — не в хранилище, туда без согласия
// ничего не пишем, — и в момент выбора уходят или выбрасываются. Иначе
// не считался бы самый важный заход, первый: главная открывается раньше,
// чем человек нажмёт кнопку баннера.
//
// ── КОГО НЕ СЧИТАЕМ ──────────────────────────────────────────────────
//
// Роботов. navigator.webdriver ставит Playwright — в том числе prod-smoke,
// который открывает главную прода после каждого слияния и согласие
// проставляет сам. Без этой проверки каждое слияние было бы «визитом».
//
// ── ПОЧЕМУ fetch С КЛЮЧОМ anon, А НЕ supabase.rpc ────────────────────
//
// supabase-js у вошедшего шлёт ЕГО токен, и запрос нёс бы личность
// человека. Ключ anon — тот же у всех. keepalive: переход по ссылке сразу
// после события (поиск с главной) не обрывает запрос.

import { readConsent } from './consent'

export type UsageEvent =
  | 'home_view'
  | 'hero_search'
  | 'browse_view'
  | 'browse_empty'
  | 'demand_sent'
  | 'listing_start'

export interface UsageDeps {
  /** Только собранный код: не `vite dev` и не тесты. */
  readonly enabled: boolean
  readonly endpoint: string
  readonly anonKey: string
  /** true — согласен, false — отказал, null — ещё не выбирал. */
  readonly consent: () => boolean | null
  readonly isRobot: () => boolean
  readonly send: (url: string, init: RequestInit) => Promise<unknown>
}

const ROBOT_UA = /bot|crawl|spider|slurp|headless|lighthouse/i

const defaultDeps = (): UsageDeps => ({
  enabled: import.meta.env.PROD,
  endpoint: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/count_usage`,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  consent: () => readConsent()?.analytics ?? null,
  isRobot: () =>
    typeof navigator !== 'undefined' &&
    (navigator.webdriver === true || ROBOT_UA.test(navigator.userAgent)),
  send: (url, init) => fetch(url, init),
})

/** До выбора больше не копим: за один заход столько событий не бывает. */
export const MAX_PENDING = 20

let pending: UsageEvent[] = []

/** Только для тестов: начать «загрузку страницы» заново. */
export function resetUsageForTests(): void {
  pending = []
}

const active = (deps: UsageDeps): boolean => deps.enabled && !!deps.anonKey && !deps.isRobot()

function post(event: UsageEvent, deps: UsageDeps): void {
  try {
    void deps
      .send(deps.endpoint, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: deps.anonKey,
          Authorization: `Bearer ${deps.anonKey}`,
        },
        body: JSON.stringify({ p_event: event }),
      })
      .catch(() => {})
  } catch {
    // Счётчик — не та вещь, ради которой можно уронить страницу.
  }
}

export function countUsage(event: UsageEvent, deps: UsageDeps = defaultDeps()): void {
  if (!active(deps)) return
  const consent = deps.consent()
  if (consent === false) return
  if (consent === null) {
    if (pending.length < MAX_PENDING) pending.push(event)
    return
  }
  post(event, deps)
}

/** Зовёт баннер в момент выбора: накопленное уходит или выбрасывается. */
export function usageConsentDecided(analytics: boolean, deps: UsageDeps = defaultDeps()): void {
  const queued = pending
  pending = []
  if (!analytics || !active(deps)) return
  queued.forEach((event) => post(event, deps))
}
