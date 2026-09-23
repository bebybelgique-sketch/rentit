// src/lib/errorReport.ts
//
// Отправка записи журнала поломок на сервер (функция report-error).
//
// ── ЗАЧЕМ ────────────────────────────────────────────────────────────
//
// Журнал на устройстве (errorLog.ts) давал человеку кнопку «скопировать
// подробности». Переслать их догадывается один из ста — остальные молча
// уходят, и владелец продукта о поломке не узнаёт никогда. Теперь запись
// уходит сама, без единого действия человека.
//
// ── ЧТО УХОДИТ ───────────────────────────────────────────────────────
//
// То же, что уже лежит в журнале, — вид, текст, след, путь без параметров,
// — плюс версия сборки, язык и строка браузера. Кто это был — НЕ уходит:
// ни почты, ни идентификатора. Телефоны и почту в тексте сервер
// маскирует ещё раз (_shared/clientErrors.ts) — на клиент не полагаемся.
//
// ── ПОЧЕМУ fetch, А НЕ supabase.functions.invoke ─────────────────────
//
// Отправка идёт из пути ПОЛОМКИ. Если сломалось что-то в supabase-js, то
// отчёт через него же не уйдёт ровно тогда, когда он нужнее всего.
// Голый fetch с keepalive переживает и уход со страницы: запрос
// дойдёт, даже если человек тут же закрыл вкладку.
//
// ── ПРЕДОХРАНИТЕЛИ ───────────────────────────────────────────────────
//
// Одна и та же поломка — один отчёт за загрузку страницы; всего — не
// больше десяти. Поломка в цикле рендера иначе слала бы сотни запросов
// в секунду с телефона человека. Своя неудача отправки молча глотается:
// иначе она сама стала бы поломкой, которую надо отправить.

import type { LoggedError } from './errorLog'

/** Больше за одну загрузку страницы не шлём. */
export const MAX_REPORTS_PER_PAGE = 10

export interface ReportDeps {
  /** Слать ли вообще: только собранный код, не `vite dev` и не тесты. */
  readonly enabled: boolean
  readonly endpoint: string
  readonly anonKey: string
  readonly release: string
  readonly lang: () => string
  readonly userAgent: () => string
  readonly send: (url: string, init: RequestInit) => Promise<unknown>
}

const defaultDeps = (): ReportDeps => ({
  enabled: import.meta.env.PROD,
  endpoint: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-error`,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  release: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev',
  lang: () => (typeof document === 'undefined' ? '' : document.documentElement.lang),
  userAgent: () => (typeof navigator === 'undefined' ? '' : navigator.userAgent),
  send: (url, init) => fetch(url, init),
})

const sent = new Set<string>()

/** Только для тестов: начать «загрузку страницы» заново. */
export function resetReportsForTests(): void {
  sent.clear()
}

export function reportError(entry: LoggedError, deps: ReportDeps = defaultDeps()): void {
  if (!deps.enabled || !deps.anonKey) return

  const key = `${entry.source}|${entry.message}`
  if (sent.has(key) || sent.size >= MAX_REPORTS_PER_PAGE) return
  sent.add(key)

  const lang = deps.lang().slice(0, 2)
  const body = {
    kind: entry.source,
    message: entry.message,
    stack: entry.stack ?? null,
    path: entry.path,
    release: deps.release,
    lang: lang === 'fr' || lang === 'nl' || lang === 'en' ? lang : null,
    userAgent: deps.userAgent(),
  }

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
        body: JSON.stringify(body),
      })
      .catch(() => {})
  } catch {
    /* см. шапку: своя неудача — не повод для новой поломки */
  }
}
