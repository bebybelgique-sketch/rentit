import { describe, it, expect } from 'vitest'
import { computeRentalPrice } from '../pricing'

// Пакет «выходные» — по правилам прокатчиков (supabase/functions/_shared/
// pricing.ts): окно пт–пн, в которое входят суббота и воскресенье. Ставки —
// из настоящего объявления о мини-экскаваторе (03.10.2026): 90 € в день,
// 350 € за неделю, 150 € за выходные.
const RATES = { pricePerDay: 90, priceWeek: 350, priceWeekend: 150 }

// Октябрь 2026: 9-е — пятница, 10-е — суббота, 11-е — воскресенье,
// 12-е — понедельник, 13-е — вторник.
const FRI = '2026-10-09'
const SAT = '2026-10-10'
const SUN = '2026-10-11'
const TUE = '2026-10-13'

describe('пакет «выходные»', () => {
  it('суббота–воскресенье — по пакету, а не 2 × 90', () => {
    expect(computeRentalPrice(RATES, 2, SAT)).toEqual({ total: 150, weeks: 0, packs3: 0, weekends: 1, days: 0 })
  })

  it('пятница–понедельник — тоже один пакет (так у прокатчиков)', () => {
    expect(computeRentalPrice(RATES, 4, FRI)).toEqual({ total: 150, weeks: 0, packs3: 0, weekends: 1, days: 0 })
  })

  it('пятница–воскресенье и суббота–понедельник — один пакет', () => {
    expect(computeRentalPrice(RATES, 3, FRI).total).toBe(150)
    expect(computeRentalPrice(RATES, 3, SAT).total).toBe(150)
  })

  it('без субботы и воскресенья вместе пакета нет', () => {
    // Одна суббота — один день.
    expect(computeRentalPrice(RATES, 1, SAT)).toEqual({ total: 90, weeks: 0, packs3: 0, weekends: 0, days: 1 })
    // Одно воскресенье — один день.
    expect(computeRentalPrice(RATES, 1, SUN).total).toBe(90)
    // Будние вт–ср — два дня по 90, пакет выходных их не касается.
    expect(computeRentalPrice(RATES, 2, TUE)).toEqual({ total: 180, weeks: 0, packs3: 0, weekends: 0, days: 2 })
  })

  it('выходные внутри длинной аренды — пакет плюс дни', () => {
    // Чт 8-е — вт 13-е, 6 дней: чт по дню, пт–пн пакетом, вт по дню —
    // 90 + 150 + 90 = 330, дешевле недели за 350.
    expect(computeRentalPrice(RATES, 6, '2026-10-08')).toEqual({ total: 330, weeks: 0, packs3: 0, weekends: 1, days: 2 })
  })

  it('неделя по-прежнему выигрывает, когда она дешевле', () => {
    // Пн 5-е — вс 11-е, 7 дней: неделя 350 против 4 × 90 + 150 = 510.
    expect(computeRentalPrice(RATES, 7, '2026-10-05')).toEqual({ total: 350, weeks: 1, packs3: 0, weekends: 0, days: 0 })
  })

  it('двое выходных в одной аренде — два пакета', () => {
    // Пт 9-е — пн 19-е, 11 дней: неделя закрывает будни, выходные — пакеты.
    const b = computeRentalPrice({ pricePerDay: 90, priceWeekend: 150 }, 11, FRI)
    // пт–пн пакет (150) + вт–чт 3 дня (270) + пт–пн пакет (150) = 570.
    expect(b).toEqual({ total: 570, weeks: 0, packs3: 0, weekends: 2, days: 3 })
  })

  it('без даты начала пакет выходных не рассматривается', () => {
    expect(computeRentalPrice(RATES, 2)).toEqual({ total: 180, weeks: 0, packs3: 0, weekends: 0, days: 2 })
  })

  it('пакет дороже своих дней просто не выбирается', () => {
    const dear = { pricePerDay: 50, priceWeekend: 120 }
    // сб–вс: 2 × 50 = 100 < 120 — дни.
    expect(computeRentalPrice(dear, 2, SAT)).toEqual({ total: 100, weeks: 0, packs3: 0, weekends: 0, days: 2 })
    // пт–пн: 4 × 50 = 200 > 120 — пакет.
    expect(computeRentalPrice(dear, 4, FRI).total).toBe(120)
  })

  it('никогда не дороже, чем по дням, с любого дня недели', () => {
    for (let start = 5; start <= 11; start++) {
      const iso = `2026-10-${String(start).padStart(2, '0')}`
      for (let d = 1; d <= 21; d++) {
        expect(computeRentalPrice(RATES, d, iso).total).toBeLessThanOrEqual(90 * d)
      }
    }
  })

  it('разбор сходится с итогом', () => {
    for (let d = 1; d <= 21; d++) {
      const b = computeRentalPrice(RATES, d, FRI)
      expect(b.total).toBeCloseTo(b.weeks * 350 + b.weekends * 150 + b.days * 90, 10)
    }
  })
})
