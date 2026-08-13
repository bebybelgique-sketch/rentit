import { describe, it, expect } from 'vitest'
import { computeRentalPrice } from '../pricing'

// Набор из совета, вокруг которого всё и затевалось: 12 €/день, 40 € за три
// дня, 70 € за неделю.
const RATES = { pricePerDay: 12, price3Days: 40, priceWeek: 70 }

describe('computeRentalPrice', () => {
  it('без тарифов на срок считает по дням', () => {
    expect(computeRentalPrice({ pricePerDay: 12 }, 5)).toEqual({
      total: 60, weeks: 0, packs3: 0, days: 5,
    })
  })

  it('берёт дни, пока пакет не выгоден', () => {
    // 2 дня: 24 € по дням против 40 € за пакет — пакет не нужен.
    expect(computeRentalPrice(RATES, 2)).toEqual({ total: 24, weeks: 0, packs3: 0, days: 2 })
    // 3 дня: 36 € по дням против 40 € — по-прежнему дни.
    expect(computeRentalPrice(RATES, 3)).toEqual({ total: 36, weeks: 0, packs3: 0, days: 3 })
  })

  it('переходит на пакет, когда он дешевле', () => {
    // 6 дней: 72 € по дням против 70 € за неделю — берём неделю, хотя она
    // длиннее срока.
    expect(computeRentalPrice(RATES, 6)).toEqual({ total: 70, weeks: 1, packs3: 0, days: 0 })
  })

  it('невыгодный пакет не выбирается никогда — и это видно на наборе 12/40/70', () => {
    // Трёхдневный пакет за 40 € дороже трёх дней по 12 €. Он не выигрывает
    // ни на одном сроке: на 4 днях 48 € по дням против 52 € с пакетом.
    expect(computeRentalPrice(RATES, 3)).toEqual({ total: 36, weeks: 0, packs3: 0, days: 3 })
    expect(computeRentalPrice(RATES, 4)).toEqual({ total: 48, weeks: 0, packs3: 0, days: 4 })
    expect(computeRentalPrice(RATES, 5)).toEqual({ total: 60, weeks: 0, packs3: 0, days: 5 })
  })

  it('выгодный трёхдневный пакет берётся', () => {
    const rates = { pricePerDay: 12, price3Days: 30, priceWeek: 70 }
    expect(computeRentalPrice(rates, 3)).toEqual({ total: 30, weeks: 0, packs3: 1, days: 0 })
    // 4 дня: пакет и день = 42 € против 48 € по дням.
    expect(computeRentalPrice(rates, 4)).toEqual({ total: 42, weeks: 0, packs3: 1, days: 1 })
    // 6 дней: два пакета = 60 € против недели за 70 € и 72 € по дням.
    expect(computeRentalPrice(rates, 6)).toEqual({ total: 60, weeks: 0, packs3: 2, days: 0 })
  })

  it('не жадничает: перебором находит дешевле, чем «сначала самый большой пакет»', () => {
    // Жадный выбор дал бы неделю + трёхдневку = 110 €.
    // Верный ответ — неделя и два дня по дневной цене.
    expect(computeRentalPrice(RATES, 9)).toEqual({ total: 94, weeks: 1, packs3: 0, days: 2 })
  })

  it('никогда не берёт больше, чем по дневной цене', () => {
    for (let d = 1; d <= 40; d++) {
      const { total } = computeRentalPrice(RATES, d)
      expect(total).toBeLessThanOrEqual(RATES.pricePerDay * d)
    }
  })

  it('пакет дороже своего срока просто не выбирается', () => {
    const bad = { pricePerDay: 10, price3Days: 90, priceWeek: 900 }
    expect(computeRentalPrice(bad, 7)).toEqual({ total: 70, weeks: 0, packs3: 0, days: 7 })
  })

  it('складывает без двоичных хвостов', () => {
    // 3 × 0.1 в двоичной дроби даёт 0.30000000000000004.
    expect(computeRentalPrice({ pricePerDay: 0.1 }, 3).total).toBe(0.3)
  })

  it('на пустой или бессмысленный вход отвечает нулями, а не бросает', () => {
    expect(computeRentalPrice(RATES, 0)).toEqual({ total: 0, weeks: 0, packs3: 0, days: 0 })
    expect(computeRentalPrice(RATES, -3)).toEqual({ total: 0, weeks: 0, packs3: 0, days: 0 })
    expect(computeRentalPrice({ pricePerDay: 0 }, 5)).toEqual({ total: 0, weeks: 0, packs3: 0, days: 0 })
    expect(computeRentalPrice({ pricePerDay: NaN }, 5)).toEqual({ total: 0, weeks: 0, packs3: 0, days: 0 })
  })

  it('разбор сходится с итогом', () => {
    for (let d = 1; d <= 30; d++) {
      const b = computeRentalPrice(RATES, d)
      const covered = b.weeks * 7 + b.packs3 * 3 + b.days
      // Пакет может покрывать больше дней, чем нужно (неделя на 6 дней),
      // поэтому покрытие не меньше срока, а сумма сходится ровно.
      expect(covered).toBeGreaterThanOrEqual(d)
      expect(b.total).toBeCloseTo(
        b.weeks * RATES.priceWeek + b.packs3 * RATES.price3Days + b.days * RATES.pricePerDay, 10,
      )
    }
  })
})
