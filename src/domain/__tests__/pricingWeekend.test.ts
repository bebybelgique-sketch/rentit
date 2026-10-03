import { describe, it, expect } from 'vitest'
import { computeRentalPrice } from '../pricing'

// Пакет «выходные» — по бельгийскому правилу Boels (supabase/functions/
// _shared/pricing.ts): суббота и воскресенье с возвратом в понедельник;
// пятница сверх пакета — ещё один день. Ставки — из настоящего объявления о
// мини-экскаваторе (03.10.2026): 90 € в день, 350 € за неделю, 150 € за
// выходные. Границы окна и сочетания с другими тарифами — по просьбе трёх
// внешних ревью (Codex, GLM, GPT, 03.10): «тестом, а не сюрпризом».
const RATES = { pricePerDay: 90, priceWeek: 350, priceWeekend: 150 }
const DAILY_AND_WEEKEND = { pricePerDay: 90, priceWeekend: 150 }

// Октябрь 2026: 8-е — четверг, 9-е — пятница, 10-е — суббота,
// 11-е — воскресенье, 12-е — понедельник, 13-е — вторник.
const THU = '2026-10-08'
const FRI = '2026-10-09'
const SAT = '2026-10-10'
const SUN = '2026-10-11'
const MON = '2026-10-05'
const TUE = '2026-10-13'

const total = (days: number, start: string, rates = DAILY_AND_WEEKEND) => computeRentalPrice(rates, days, start).total

describe('пакет «выходные»: окно', () => {
  it('сб–вс — пакет', () => {
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 2, SAT)).toEqual({ total: 150, weeks: 0, packs3: 0, weekends: 1, days: 0 })
  })

  it('сб–пн — пакет: возврат в понедельник входит, как у Boels', () => {
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 3, SAT)).toEqual({ total: 150, weeks: 0, packs3: 0, weekends: 1, days: 0 })
  })

  it('пт–вс и пт–пн — день плюс пакет: пятница даром не отдаётся', () => {
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 3, FRI)).toEqual({ total: 240, weeks: 0, packs3: 0, weekends: 1, days: 1 })
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 4, FRI)).toEqual({ total: 240, weeks: 0, packs3: 0, weekends: 1, days: 1 })
  })

  it('без субботы или без воскресенья пакета нет', () => {
    expect(total(2, FRI)).toBe(180) // пт–сб
    expect(total(2, SUN)).toBe(180) // вс–пн
    expect(total(1, SAT)).toBe(90) // одна суббота
    expect(total(1, SUN)).toBe(90) // одно воскресенье
    expect(total(2, TUE)).toBe(180) // будние вт–ср
  })

  // Boels: «samedi – lundi» — один дневной тариф, «vendredi – lundi» — два.
  // Владелец, назначивший пакет по цене дня, получает ровно это.
  it('пакет по цене дня — ровно правило Boels', () => {
    const boels = { pricePerDay: 90, priceWeekend: 90 }
    expect(total(3, SAT, boels)).toBe(90)
    expect(total(4, FRI, boels)).toBe(180)
  })
})

describe('пакет «выходные»: выходные и прилегающие будни', () => {
  it('пт–вт — день, пакет сб–пн, день', () => {
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 5, FRI)).toEqual({ total: 330, weeks: 0, packs3: 0, weekends: 1, days: 2 })
  })

  it('чт–пн — два дня и пакет', () => {
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 5, THU)).toEqual({ total: 330, weeks: 0, packs3: 0, weekends: 1, days: 2 })
  })

  it('неделя выигрывает, когда она дешевле: чт–вт за 350, а не 420', () => {
    expect(computeRentalPrice(RATES, 6, THU)).toEqual({ total: 350, weeks: 1, packs3: 0, weekends: 0, days: 0 })
  })

  it('пн–вс — неделя', () => {
    expect(computeRentalPrice(RATES, 7, MON)).toEqual({ total: 350, weeks: 1, packs3: 0, weekends: 0, days: 0 })
  })

  it('двое выходных в одной аренде — два пакета', () => {
    // Пт 9-е — пн 19-е: пт по дню, сб–пн пакет, вт–пт по дням, сб–пн пакет.
    expect(computeRentalPrice(DAILY_AND_WEEKEND, 11, FRI)).toEqual({ total: 750, weeks: 0, packs3: 0, weekends: 2, days: 5 })
  })
})

describe('пакет «выходные»: прочее', () => {
  it('без даты начала пакет не рассматривается', () => {
    expect(computeRentalPrice(RATES, 2)).toEqual({ total: 180, weeks: 0, packs3: 0, weekends: 0, days: 2 })
  })

  it('пакет дороже своих дней не выбирается', () => {
    const dear = { pricePerDay: 50, priceWeekend: 120 }
    expect(total(2, SAT, dear)).toBe(100) // сб–вс: 2 × 50 < 120
    expect(total(3, SAT, dear)).toBe(120) // сб–пн: 3 × 50 > 120
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
    for (const start of [THU, FRI, SAT, SUN, MON, TUE]) {
      for (let d = 1; d <= 21; d++) {
        const b = computeRentalPrice(RATES, d, start)
        expect(b.total).toBeCloseTo(b.weeks * 350 + b.weekends * 150 + b.days * 90, 10)
      }
    }
  })
})
