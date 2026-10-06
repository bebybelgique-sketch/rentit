import { describe, it, expect } from 'vitest'
import { weekendRange, weekendLabel, isoDay, isIsoDay } from '../weekend'

// Октябрь 2026: 5-е — понедельник, 9-е — пятница, 10-е — суббота,
// 11-е — воскресенье. Время суток — поздний вечер: день не должен
// «уехать» вперёд из-за перевода в UTC.
const at = (day: number, hour = 23) => new Date(2026, 9, day, hour, 30)

describe('выходные для поля «Quand ?»', () => {
  it('в будни — ближайшие суббота и воскресенье', () => {
    expect(weekendRange(at(5), 'this')).toEqual({ from: '2026-10-10', to: '2026-10-11' })
    expect(weekendRange(at(9), 'this')).toEqual({ from: '2026-10-10', to: '2026-10-11' })
  })

  it('в субботу — сегодня и завтра', () => {
    expect(weekendRange(at(10), 'this')).toEqual({ from: '2026-10-10', to: '2026-10-11' })
  })

  it('в воскресенье субботу уже не взять — только сегодня', () => {
    expect(weekendRange(at(11), 'this')).toEqual({ from: '2026-10-11', to: '2026-10-11' })
  })

  it('«le week-end prochain» — следующие за ближайшими', () => {
    expect(weekendRange(at(5), 'next')).toEqual({ from: '2026-10-17', to: '2026-10-18' })
    expect(weekendRange(at(10), 'next')).toEqual({ from: '2026-10-17', to: '2026-10-18' })
    expect(weekendRange(at(11), 'next')).toEqual({ from: '2026-10-17', to: '2026-10-18' })
  })

  it('через границу месяца и года', () => {
    expect(weekendRange(new Date(2026, 11, 29, 9), 'this')).toEqual({ from: '2027-01-02', to: '2027-01-03' })
  })

  it('день берётся по местному времени, а не по UTC', () => {
    // 00:30 по Брюсселю — это ещё вчерашний день в UTC.
    expect(isoDay(new Date(2026, 9, 10, 0, 30))).toBe('2026-10-10')
  })
})

describe('дни из адреса', () => {
  it('принимает только существующий день в формате витрины', () => {
    expect(isIsoDay('2026-10-10')).toBe(true)
    expect(isIsoDay('2026-02-31')).toBe(false)
    expect(isIsoDay('10/10/2026')).toBe(false)
    expect(isIsoDay('')).toBe(false)
    expect(isIsoDay(null)).toBe(false)
  })
})

describe('подпись выходных в иллюстрациях', () => {
  it('месяц один раз, если он общий', () => {
    expect(weekendLabel(at(5), 'fr')).toBe('sam. 10 → dim. 11 oct.')
  })

  it('через границу месяца — у каждого дня свой месяц', () => {
    expect(weekendLabel(new Date(2026, 9, 30, 12), 'fr')).toBe('sam. 31 oct. → dim. 1 nov.')
  })

  it('в воскресенье — один день', () => {
    expect(weekendLabel(at(11), 'fr')).toBe('dim. 11 oct.')
  })
})
