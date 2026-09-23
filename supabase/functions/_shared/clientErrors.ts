// supabase/functions/_shared/clientErrors.ts
//
// Отчёт о поломке из браузера: что принять, что отбросить, как сгруппировать.
//
// Файл без Deno, сети и supabase-js — чистый разбор. Поэтому проверяется
// обычным vitest (__tests__/clientErrors.test.ts), а функция report-error
// рядом остаётся тонкой. Та же схема, что у admin-action/actions.ts.
//
// ── ПРИЁМ ОТКРЫТ ДЛЯ ВСЕХ — ЗНАЧИТ ВСЁ, ЧТО ПРИШЛО, ЧУЖОЕ ─────────────
//
// Отчёт присылает браузер без входа, и подделать его может кто угодно.
// Поэтому здесь:
//   • длина каждого поля обрезается до предела таблицы (миграция 41);
//   • телефоны и адреса почты маскируются: текст ошибки иногда несёт
//     введённое человеком. Правило для телефонов — общее с уведомлениями
//     (pushCopy.maskPhones), для почты — строже (см. EMAIL_STRICT);
//   • путь — только путь: строка запроса и хеш отрезаются даже если их
//     прислали (в ссылках из писем бывают одноразовые токены);
//   • шум отбрасывается: чужие расширения браузера, «Script error.» без
//     следа (скрипт с другого сайта), петля ResizeObserver.

import { MASK, maskPhones } from './pushCopy.ts'

/**
 * Почта — СТРОГО: после «@» домен из слов через точки, а за ним ни «/», ни
 * «:». Широкая маска уведомлений здесь не годится: след стека Firefox
 * пишет место как «Kt@https://…/ItemDetail.js:1:2», и широкая маска
 * съедала весь след — отчёт терял место поломки, а отпечаток той же
 * поломки в Firefox и в Chrome получался разным.
 */
//
// Длины ограничены (64 на имя, 63 на часть домена) не для красоты: без
// ограничения шаблон на длинной строке без «@» перебирает квадратично, а
// приём открыт всем — 50 000 знаков «стека» стоили разбору ~4 секунд, а
// мегабайт вешал его на минуты. Нашёл это тест на время ниже.
const EMAIL_STRICT = /[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+(?![\w/:.-])/g

/**
 * Обрезка С ЗАПАСОМ до маски, маска, потом обрезка до предела. Запас — чтобы
 * номер на границе не остался разрезанным и потому неузнанным;
 * предварительная обрезка — чтобы маска не работала по мегабайту мусора.
 */
const maskWithin = (text: string, max: number): string =>
  cut(maskPhones(cut(text, max + 64).replace(EMAIL_STRICT, MASK)), max)

export type ClientErrorKind = 'render' | 'promise' | 'window'

export interface ClientErrorReport {
  readonly kind: ClientErrorKind
  readonly message: string
  readonly stack: string | null
  readonly path: string
  readonly release: string | null
  readonly userAgent: string | null
  readonly lang: 'fr' | 'nl' | 'en' | null
}

export const LIMITS = { message: 500, stack: 2000, path: 200, release: 40, userAgent: 300 } as const

const KINDS: readonly ClientErrorKind[] = ['render', 'promise', 'window']

/** Обрезка по знакам, а не кодовым единицам: эмодзи не рвётся пополам. */
const cut = (text: string, max: number): string => {
  // Сначала дёшево по кодовым единицам: 2·max единиц дают не меньше max
  // знаков. Разложить на знаки мегабайт, чтобы оставить пятьсот, — работа
  // впустую на открытом приёме.
  const chars = Array.from(text.length > max * 2 ? text.slice(0, max * 2) : text)
  return chars.length <= max ? text : chars.slice(0, max - 1).join('') + '…'
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Путь без строки запроса и хеша. Не путь — отказ. */
export function cleanPath(raw: string | null): string | null {
  if (!raw) return null
  const path = raw.split(/[?#]/)[0]
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return cut(path, LIMITS.path)
}

/**
 * Шум, который не про нас.
 *
 * «Script error.» без следа — так браузер скрывает ошибку скрипта с
 * ЧУЖОГО сайта: ни текста, ни места, починить нечего. Расширения браузера
 * падают внутри наших страниц и приходят с адресами chrome-extension:// —
 * это их поломки. Петля ResizeObserver — безвредное предупреждение,
 * которое браузеры выдают за ошибку.
 */
export function isNoise(message: string, stack: string | null): boolean {
  if (/^script error\.?$/i.test(message.trim()) && !stack) return true
  if (/(chrome|moz|safari(-web)?)-extension:\/\//i.test(`${message}\n${stack ?? ''}`)) return true
  if (/ResizeObserver loop/i.test(message)) return true
  return false
}

/** Разобрать тело запроса. `null` — не отчёт или шум. */
export function parseReport(raw: unknown): ClientErrorReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = raw as Record<string, unknown>

  const kind = KINDS.find((k) => k === b.kind)
  if (!kind) return null

  const rawMessage = str(b.message)?.trim()
  if (!rawMessage) return null
  const rawStack = str(b.stack)?.trim() || null
  if (isNoise(rawMessage, rawStack)) return null

  const path = cleanPath(str(b.path))
  if (!path) return null

  const release = str(b.release)
  const lang = b.lang === 'fr' || b.lang === 'nl' || b.lang === 'en' ? b.lang : null
  const userAgent = str(b.userAgent)

  return {
    kind,
    message: maskWithin(rawMessage, LIMITS.message),
    stack: rawStack ? maskWithin(rawStack, LIMITS.stack) : null,
    path,
    release: release && /^[A-Za-z0-9._-]{1,40}$/.test(release) ? release : null,
    userAgent: userAgent ? cut(userAgent, LIMITS.userAgent) : null,
    lang,
  }
}

// ── Отпечаток ───────────────────────────────────────────────────────

/**
 * Текст без того, что меняется от раза к разу при ОДНОЙ И ТОЙ ЖЕ поломке:
 * идентификаторы, числа, хеши в именах файлов. «Cannot read 'x' of
 * undefined at item 3f2a…» у двух людей — одна поломка, а не две.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Первая строка стека, где есть МЕСТО, — без номера строки и без хеша
 * в имени файла: после каждой сборки они другие, а поломка та же.
 *   «at Kt (https://site/assets/ItemDetail-B7v_NMCH.js:1:2345)» → «Kt@ItemDetail»
 */
export function topFrame(stack: string | null): string {
  if (!stack) return ''
  for (const line of stack.split('\n')) {
    // Три записи одного и того же места — у разных браузеров:
    //   Chrome/Edge:     «    at Kt (https://…/ItemDetail-B7v_NMCH.js:1:2345)»
    //   Chrome, аноним:  «    at https://…/index-u_axv-YY.js:40:120»
    //   Firefox/Safari:  «Kt@https://…/ItemDetail-B7v_NMCH.js:1:2345»
    // Без разбора по формату одна поломка давала бы разные отпечатки в
    // разных браузерах.
    const frame =
      /^\s*at\s+(.*?)\s+\((.*)\)\s*$/.exec(line) ??
      /^\s*at\s+()(\S+)\s*$/.exec(line) ??
      /^\s*([^@\s]*)@(\S+)\s*$/.exec(line)
    if (!frame) continue
    const file = /\/([\w.-]+?)(?:-[\w-]{6,})?\.(?:m?js|jsx|tsx?)(?::\d+)*$/.exec(frame[2])
    if (!file) continue
    const fn = frame[1].replace(/[^\w$.]/g, '').split('.').pop() ?? ''
    return `${fn}@${file[1]}`
  }
  return ''
}

/** Путь как шаблон: /item/<id>, а не сотня разных адресов одной поломки. */
export const pathPattern = (path: string): string =>
  path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')

/** SHA-256 от вида, текста, места и страницы; 32 знака хватает с запасом. */
export async function fingerprintOf(report: ClientErrorReport): Promise<string> {
  const basis = [report.kind, normalizeMessage(report.message), topFrame(report.stack), pathPattern(report.path)].join('|')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(basis))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}
