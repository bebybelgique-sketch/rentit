import { weekendRange, type WeekendChoice } from '../../domain/weekend'

export type WhenChoice = '' | WeekendChoice

/**
 * Адрес витрины по ответам поиска на первом экране.
 *
 * Имена параметров — те, что витрина читает (src/pages/Home.tsx): `q`,
 * `where`, `from`/`to`. Пустой ответ в адрес не попадает: `?q=` открыл бы
 * панель фильтров с пустым отбором и числом «1» на кнопке.
 */
export function browseHref(what: string, where: string, when: WhenChoice, today: Date): string {
  const p = new URLSearchParams()
  if (what.trim()) p.set('q', what.trim())
  if (where.trim()) p.set('where', where.trim())
  if (when) {
    const { from, to } = weekendRange(today, when)
    p.set('from', from)
    p.set('to', to)
  }
  const qs = p.toString()
  return qs ? `/browse?${qs}` : '/browse'
}
