// src/lib/errorLog.ts
//
// Журнал поломок на устройстве человека.
//
// ── ЧТО ЭТО РЕШАЕТ, А ЧТО НЕТ ────────────────────────────────────────
//
// НЕ решает: владелец продукта по-прежнему не узнаёт о поломке у чужого
// человека. Для этого нужен приём отчётов на сервере — отдельная работа
// с таблицей и функцией, и делать вид, что она сделана, нельзя.
//
// Решает: когда у человека что-то ломается, он видит не пустой экран, а
// экран с объяснением и кнопкой «скопировать подробности». Сегодня
// единственный след поломки — строка в консоли, которую никто никогда не
// откроет. Разница между «у меня не работает» и письмом с точным местом
// падения — это разница между двумя часами переписки и двумя минутами.
//
// ── ПОЧЕМУ sessionStorage, А НЕ localStorage ─────────────────────────
//
// Журнал нужен ровно в ту сессию, где сломалось. Пережившие вкладку
// записи только путают: человек копирует вчерашнюю ошибку к сегодняшней
// жалобе.
//
// ── ПОЧЕМУ ЗДЕСЬ НЕТ НИ ОДНОГО ЛИЧНОГО ПОЛЯ ──────────────────────────
//
// Ни почты, ни имени, ни содержимого форм. Журнал предназначен для
// пересылки, и человек, нажимающий «скопировать», не обязан
// догадываться, что вместе с ошибкой уедет его адрес. Адрес страницы
// тоже чистится от параметров: в `?lang=` ничего личного нет, а вот в
// ссылке из письма бывает одноразовый токен.

const KEY = 'rentit_error_log'

/** Сколько записей держим. Больше — бесполезно: чинят по первой. */
const LIMIT = 10

/** Длина следа. Полный стек не помещается ни в одно сообщение. */
const STACK_LIMIT = 1200

export interface LoggedError {
  /** Момент по часам человека — так он опишет его в жалобе. */
  at: string
  /** Откуда пришло: рендер, обещание, глобальная ошибка. */
  source: 'render' | 'promise' | 'window'
  message: string
  stack?: string
  /** Адрес БЕЗ параметров — см. шапку про токены. */
  path: string
}

const safeRead = (): LoggedError[] => {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LoggedError[]) : []
  } catch {
    // Приватный режим, переполненное хранилище, испорченный JSON —
    // журнал не та вещь, ради которой можно уронить приложение.
    return []
  }
}

const safeWrite = (items: LoggedError[]): void => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* см. выше */
  }
}

/** Адрес без строки запроса и без хеша. */
const cleanPath = (): string => {
  try {
    return window.location.pathname
  } catch {
    return '?'
  }
}

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error).slice(0, 300)
  } catch {
    return String(error)
  }
}

export function logError(source: LoggedError['source'], error: unknown): void {
  const entry: LoggedError = {
    at: new Date().toISOString(),
    source,
    message: messageOf(error),
    stack: error instanceof Error && error.stack ? error.stack.slice(0, STACK_LIMIT) : undefined,
    path: cleanPath(),
  }

  // Новая запись первой: чинят по последней поломке, а не по первой.
  safeWrite([entry, ...safeRead()].slice(0, LIMIT))

  // В консоль — тоже. Разработчик, открывший её, не должен идти за
  // журналом.
  console.error(`[${source}]`, error)
}

export const readErrorLog = (): LoggedError[] => safeRead()

export const clearErrorLog = (): void => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* см. выше */
  }
}

/**
 * Журнал в виде текста для пересылки.
 *
 * Версия сборки и строка браузера добавляются сюда, а не в каждую
 * запись: они одинаковы для всей сессии, и повторять их десять раз
 * значит сделать сообщение нечитаемым.
 */
export function formatErrorLog(): string {
  const items = safeRead()
  if (items.length === 0) return ''

  const head = [
    `RentIt · ${new Date().toISOString()}`,
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
    '',
  ]

  const body = items.map((e, i) =>
    [
      `${i + 1}. [${e.source}] ${e.at} ${e.path}`,
      `   ${e.message}`,
      e.stack ? e.stack.split('\n').slice(0, 6).map((l) => `   ${l.trim()}`).join('\n') : '',
    ].filter(Boolean).join('\n'))

  return [...head, ...body].join('\n')
}

/**
 * Ловим то, что мимо React.
 *
 * Перехватчик компонентов (ErrorBoundary) видит только ошибки рендера.
 * Отклонённое обещание в обработчике нажатия, ошибка в setTimeout, сбой
 * загрузки скрипта — всё это проходит мимо него и исчезает в консоли.
 */
export function installErrorCapture(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('unhandledrejection', (event) => {
    logError('promise', event.reason)
  })

  window.addEventListener('error', (event) => {
    // Событие `error` на window прилетает и от <img>, и от <script>, у
    // которых нет `error.message`. Такие пишем как есть, но не выдаём за
    // исключение.
    logError('window', event.error ?? event.message ?? 'ошибка загрузки ресурса')
  })
}
