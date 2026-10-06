/**
 * Выходные для поля «Quand ?» на первом экране.
 *
 * Поле предлагает не календарь, а два готовых ответа — «ce week-end» и
 * «le week-end prochain»: так спрашивают о вещи на субботу, и так её ищут.
 * Точные даты выбираются на витрине, куда поиск и ведёт.
 *
 * Даты считаются от сегодняшнего дня, а не пишутся в словарь: «sam. 11 →
 * dim. 12 oct.» строкой была бы верна одну неделю.
 */

/** YYYY-MM-DD по МЕСТНОМУ времени. `toISOString` дал бы UTC — и в час ночи по Брюсселю вчерашний день. */
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Строка — день в формате витрины, и такой день существует (не 2026-02-31). */
export const isIsoDay = (v: string | null | undefined): v is string => {
  if (!v || !DAY.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export type WeekendChoice = 'this' | 'next'

const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * Пн–сб: «ce week-end» — ближайшие суббота и воскресенье (в субботу — сегодня
 * и завтра). В воскресенье субботу уже не взять: «ce week-end» — один
 * сегодняшний день. «Le week-end prochain» — следующие за ними суббота и
 * воскресенье.
 */
export function weekendRange(today: Date, which: WeekendChoice): { from: string; to: string } {
  const dow = today.getDay() // 0 — воскресенье
  if (which === 'this' && dow === 0) {
    const d = isoDay(today)
    return { from: d, to: d }
  }
  const toSaturday = dow === 0 ? 6 : 6 - dow
  const saturday = addDays(today, toSaturday + (which === 'next' && dow !== 0 ? 7 : 0))
  return { from: isoDay(saturday), to: isoDay(addDays(saturday, 1)) }
}
