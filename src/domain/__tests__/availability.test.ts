import { describe, it, expect } from 'vitest'
import {
  toISODate, addDaysISO, daysBetween,
  parseCalendar, firstUnavailableDay, isTooSoon, isSelectable,
} from '../availability'
import type { ItemCalendar } from '../availability'

// Сам расчёт занятости живёт в базе (public.unavailable_days) и проверен на
// живой базе: две единицы и одна бронь — свободно, две брони — занято.
// Здесь проверяется вторая половина: как браузер ЧИТАЕТ этот ответ. Именно
// на ней и ломалось раньше — isBooked() считала пересечение сама и с
// количеством единиц стала бы прямо неверной.

const cal = (days: [string, string][], earliest = '2026-08-17'): ItemCalendar =>
  parseCalendar(
    { earliest_start: earliest, quantity: 1, days: days.map(([day, reason]) => ({ day, reason })) },
    earliest,
  )

describe('даты как строки', () => {
  it('toISODate берёт МЕСТНЫЙ день, а не UTC', () => {
    // 12.08 на этом и споткнулись: `toISOString()` у полуночи по Брюсселю
    // отдаёт предыдущую дату, и бронь на сегодня отклонялась весь день.
    const localMidnight = new Date(2026, 7, 17, 0, 30)
    expect(toISODate(localMidnight)).toBe('2026-08-17')
  })

  it('addDaysISO переходит через конец месяца и года', () => {
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('daysBetween включает оба конца', () => {
    expect(daysBetween('2026-08-17', '2026-08-19'))
      .toEqual(['2026-08-17', '2026-08-18', '2026-08-19'])
    expect(daysBetween('2026-08-17', '2026-08-17')).toEqual(['2026-08-17'])
  })

  it('daysBetween не зацикливается на перевёрнутом отрезке', () => {
    expect(daysBetween('2026-08-19', '2026-08-17')).toEqual([])
  })
})

describe('разбор ответа базы', () => {
  it('пустой ответ не роняет страницу', () => {
    const c = parseCalendar(null, '2026-08-17')
    expect(c.unavailable.size).toBe(0)
    expect(c.quantity).toBe(1)
    expect(c.earliestStart).toBe('2026-08-17')
  })

  it('количество единиц читается, а мусор приводится к одной', () => {
    expect(parseCalendar({ quantity: 12, days: [] }, '2026-08-17').quantity).toBe(12)
    expect(parseCalendar({ quantity: 0, days: [] }, '2026-08-17').quantity).toBe(1)
    expect(parseCalendar({ quantity: null, days: [] }, '2026-08-17').quantity).toBe(1)
  })

  it('причина сохраняется: бронь и перерыв владельца — разные сообщения', () => {
    const c = cal([['2026-08-20', 'booked'], ['2026-08-21', 'blocked']])
    expect(c.unavailable.get('2026-08-20')).toBe('booked')
    expect(c.unavailable.get('2026-08-21')).toBe('blocked')
  })

  it('незнакомая причина не выдаётся за перерыв владельца', () => {
    const c = cal([['2026-08-20', 'какая-то новая']])
    expect(c.unavailable.get('2026-08-20')).toBe('booked')
  })
})

describe('выбор отрезка', () => {
  it('свободный отрезок не находит помех', () => {
    const c = cal([['2026-08-25', 'booked']])
    expect(firstUnavailableDay(c, '2026-08-18', '2026-08-22')).toBeNull()
  })

  it('называет ПЕРВЫЙ мешающий день, а не просто «нельзя»', () => {
    const c = cal([['2026-08-20', 'booked'], ['2026-08-21', 'booked']])
    expect(firstUnavailableDay(c, '2026-08-18', '2026-08-22')).toBe('2026-08-20')
  })

  it('видит помеху на самом краю отрезка', () => {
    const c = cal([['2026-08-22', 'blocked']])
    expect(firstUnavailableDay(c, '2026-08-18', '2026-08-22')).toBe('2026-08-22')
  })
})

describe('срок предупреждения', () => {
  const c = cal([], '2026-08-20')

  it('день раньше самого раннего старта — рано', () => {
    expect(isTooSoon(c, '2026-08-19')).toBe(true)
    expect(isTooSoon(c, '2026-08-20')).toBe(false)
    expect(isTooSoon(c, '2026-08-21')).toBe(false)
  })

  it('нулевой срок никого не задерживает', () => {
    expect(isTooSoon(cal([], '2026-08-17'), '2026-08-17')).toBe(false)
  })
})

describe('можно ли нажать на день', () => {
  const today = '2026-08-17'
  const c = cal([['2026-08-25', 'booked'], ['2026-08-26', 'blocked']], '2026-08-19')

  it('прошедший день не берётся', () => {
    expect(isSelectable(c, '2026-08-16', today)).toBe(false)
  })

  it('слишком ранний день не берётся', () => {
    expect(isSelectable(c, '2026-08-18', today)).toBe(false)
  })

  it('занятый и закрытый владельцем не берутся', () => {
    expect(isSelectable(c, '2026-08-25', today)).toBe(false)
    expect(isSelectable(c, '2026-08-26', today)).toBe(false)
  })

  it('свободный день берётся', () => {
    expect(isSelectable(c, '2026-08-19', today)).toBe(true)
    expect(isSelectable(c, '2026-08-27', today)).toBe(true)
  })
})
