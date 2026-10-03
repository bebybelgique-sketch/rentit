import { describe, it, expect } from 'vitest'
import { inclusiveDays, isISODate } from '../availability'

// Заявка измеряется сутками. До 03.10 request-rental разбирал даты через
// `new Date()` — тот принимает и часы, и пояса, и несуществующие дни, — а в
// бронь клал присланную строку, которую база приводит к дню по написанным
// цифрам. Дни в цене и дни в брони могли разойтись.

describe('isISODate', () => {
  it('календарный день YYYY-MM-DD — да', () => {
    expect(isISODate('2026-10-10')).toBe(true)
    expect(isISODate('2028-02-29')).toBe(true) // високосный
  })

  it('с часами или поясом — нет', () => {
    expect(isISODate('2026-10-10T23:00:00-11:00')).toBe(false)
    expect(isISODate('2026-10-10T00:00:00Z')).toBe(false)
    expect(isISODate('2026-10-10 ')).toBe(false)
  })

  it('несуществующий день — нет (Date молча сделал бы из него другой)', () => {
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('2027-02-29')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
  })

  it('не строка или другой формат — нет', () => {
    expect(isISODate(undefined)).toBe(false)
    expect(isISODate(20261010)).toBe(false)
    expect(isISODate('October 10, 2026')).toBe(false)
    expect(isISODate('10/10/2026')).toBe(false)
  })
})

describe('inclusiveDays', () => {
  it('один и тот же день — один день', () => {
    expect(inclusiveDays('2026-10-10', '2026-10-10')).toBe(1)
  })

  it('через переход на зимнее время — по календарю, без потерянного часа', () => {
    // 25.10.2026 в Бельгии сутки длиной 25 часов.
    expect(inclusiveDays('2026-10-24', '2026-10-26')).toBe(3)
    expect(inclusiveDays('2026-03-28', '2026-03-30')).toBe(3)
  })

  it('через границу месяца и года', () => {
    expect(inclusiveDays('2026-12-30', '2027-01-02')).toBe(4)
  })

  it('конец раньше начала — меньше одного', () => {
    expect(inclusiveDays('2026-10-11', '2026-10-10')).toBeLessThan(1)
  })
})
