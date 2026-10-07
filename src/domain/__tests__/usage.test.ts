import { describe, it, expect } from 'vitest'
import { summarizeUsage } from '../usage'

describe('summarizeUsage', () => {
  const today = '2026-10-20'

  it('пусто — нули, первого дня нет, долей нет', () => {
    const s = summarizeUsage([], today)
    expect(s.since).toBeNull()
    expect(s.total.home_view).toBe(0)
    expect(s.ratios).toEqual({ homeToSearch: null, browseEmpty: null, emptyToDemand: null })
  })

  it('итог «с первого дня» и окно в 7 дней, включая сегодня', () => {
    const s = summarizeUsage([
      { day: '2026-10-20', event: 'home_view', count: 3 },
      { day: '2026-10-14', event: 'home_view', count: 2 }, // шестью сутками раньше — внутри окна
      { day: '2026-10-13', event: 'home_view', count: 5 }, // седьмыми — уже снаружи
      { day: '2026-10-07', event: 'home_view', count: 10 },
    ], today)
    expect(s.total.home_view).toBe(20)
    expect(s.last7.home_view).toBe(5)
    expect(s.since).toBe('2026-10-07')
  })

  it('доли пути: поиск с главной, пустая витрина, спрос после пустоты', () => {
    const s = summarizeUsage([
      { day: today, event: 'home_view', count: 40 },
      { day: today, event: 'hero_search', count: 10 },
      { day: today, event: 'browse_view', count: 20 },
      { day: today, event: 'browse_empty', count: 15 },
      { day: today, event: 'demand_sent', count: 3 },
    ], today)
    expect(s.ratios.homeToSearch).toBe(0.25)
    expect(s.ratios.browseEmpty).toBe(0.75)
    expect(s.ratios.emptyToDemand).toBe(0.2)
  })

  // Событие, которого клиент не знает (добавили в базу раньше, чем в сборку),
  // не ломает сводку и не попадает в чужую строку.
  it('незнакомое событие пропускается', () => {
    const s = summarizeUsage([{ day: today, event: 'future_event', count: 99 }], today)
    expect(Object.values(s.total).every((n) => n === 0)).toBe(true)
    expect(s.since).toBeNull()
  })
})
