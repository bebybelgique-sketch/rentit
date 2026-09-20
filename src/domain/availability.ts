// src/domain/availability.ts
//
// НЕ КОПИЯ, А РЕЭКСПОРТ. Правило доступности живёт в базе (функции
// `unavailable_days` и `item_earliest_start`, миграция 20260817000022), а
// то, как его спрашивают и толкуют, — в
// `supabase/functions/_shared/availability.ts`.
//
// Здесь только реэкспорт и один переходник к браузерному клиенту, чтобы
// страницам не приходилось помнить имена RPC. Своей арифметики
// пересечений в `src/` больше нет нигде — это стережёт
// `scripts/check-availability-single-source.mjs`.

// Клиент подключается ЛЕНИВО, внутри функции. На верхнем уровне его импорт
// ронял бы весь модуль там, где нет .env: `lib/supabase.ts` бросает при
// загрузке, если переменных нет. Из-за этого чистые помощники — те, что
// не ходят в сеть вовсе, — оказывались недоступны в CI.
import {
  fetchItemCalendar as fetchWithRpc,
  toISODate,
} from '../../supabase/functions/_shared/availability'
import type { ItemCalendar } from '../../supabase/functions/_shared/availability'

export {
  toISODate,
  addDaysISO,
  daysBetween,
  firstUnavailableDay,
  isTooSoon,
  isSelectable,
  parseCalendar,
} from '../../supabase/functions/_shared/availability'

export type {
  ItemCalendar,
  UnavailableDay,
  UnavailableReason,
  RangeProblem,
} from '../../supabase/functions/_shared/availability'

/** Насколько вперёд страница вещи спрашивает календарь. */
export const CALENDAR_HORIZON_DAYS = 365

/**
 * Календарь вещи для браузера. Окно — год вперёд: календарь листается
 * помесячно без ограничения, а второй раз ходить за теми же данными при
 * каждом перелистывании незачем.
 */
export async function loadItemCalendar(itemId: string): Promise<ItemCalendar> {
  const { supabase } = await import('../lib/supabase')
  const today = new Date()
  const from = toISODate(today)
  const to = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + CALENDAR_HORIZON_DAYS))
  const rpc = supabase.rpc.bind(supabase) as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
  return fetchWithRpc((fn, args) => rpc(fn, args), itemId, from, to)
}

/**
 * Сколько пустых клеток стоит перед первым числом месяца.
 *
 * Неделя начинается с ПОНЕДЕЛЬНИКА. `Date.getDay()` считает от воскресенья
 * — американское соглашение, — и календарь на странице вещи съезжал на день
 * относительно того, как неделю читают в Бельгии и вообще в Европе.
 * Сдвиг `(d + 6) % 7` переводит воскресенье-первое в понедельник-первое.
 */
export const monthStartOffset = (year: number, month: number): number =>
  (new Date(year, month, 1).getDay() + 6) % 7

/**
 * Подписи дней недели, от понедельника, на языке читателя.
 *
 * Берутся у платформы, а не из словарей: держать три копии названий дней и
 * сводить их вручную — работа, которую Intl уже сделал, и лишний способ
 * разойтись. До 20.09 здесь стоял массив ['Di','Lu',…] — французские
 * подписи для англичанина и голландца, да ещё и с воскресенья.
 *
 * 5 января 2026 — понедельник; дальше просто по дням.
 */
export const weekdayLabels = (locale: string): string[] =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'short' }),
  )
