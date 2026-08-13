// supabase/functions/_shared/pricing.ts
//
// Расчёт стоимости аренды с тарифами на срок.
//
// ЗАЧЕМ файл лежит здесь, а не в `src/domain/`. Цену считает сервер
// (`request-rental` — единственный, кто пишет `total_price` в бронь), но
// показать её обязан и клиент, до нажатия кнопки. Две реализации одной
// формулы разошлись бы молча: человек увидел бы одну сумму, а в брони
// оказалась бы другая, и заметили бы это уже двое живых людей при встрече.
//
// Поэтому реализация ОДНА, и лежит она на стороне сервера как у владельца
// правды. `src/domain/pricing.ts` — реэкспорт этого файла, а не копия.
// Файл намеренно чистый: ни одного обращения к Deno или к сети, иначе его
// не удастся импортировать в браузерный бандл.
//
// ПРАВИЛО РАСЧЁТА. Владелец задаёт цену за день и, по желанию, цену за
// пакет «3 дня» и «неделя». Мы подбираем самое дешёвое сочетание пакетов и
// одиночных дней — перебором по дням, а не жадно: жадный выбор на наборе
// 12/40/70 даёт для 9 дней 70+40 = 110, тогда как 70+2×12 = 94.
//
// Из правила следует свойство, которое и нужно человеку: арендатор НИКОГДА
// не платит больше, чем по дневной цене, и пакет короче срока не мешает —
// пятидневная аренда возьмёт недельный пакет, если он дешевле пяти дней.

export type RentalRates = {
  pricePerDay: number
  /** Цена за пакет из трёх дней. `null` — владелец такого тарифа не назначил. */
  price3Days?: number | null
  /** Цена за пакет из семи дней. */
  priceWeek?: number | null
}

export type PriceBreakdown = {
  /** Итог к оплате владельцу наличными, в евро. */
  total: number
  /** Сколько недельных пакетов вошло в итог. */
  weeks: number
  /** Сколько трёхдневных пакетов вошло в итог. */
  packs3: number
  /** Сколько дней осталось по дневной цене. */
  days: number
}

/** Деньги считаем в центах: 0.1 + 0.2 в двоичной дроби даёт 0.30000000000000004. */
const toCents = (v: number) => Math.round(v * 100)
const fromCents = (c: number) => c / 100

const EMPTY: PriceBreakdown = { total: 0, weeks: 0, packs3: 0, days: 0 }

/**
 * Возвращает самое дешёвое сочетание тарифов на `totalDays` дней.
 *
 * Некорректная дневная цена (ноль, отрицательная, NaN) — не наше дело
 * поправлять: возвращаем нули, а отказ выдаёт вызывающая сторона, у которой
 * есть чем ответить человеку.
 */
export function computeRentalPrice(rates: RentalRates, totalDays: number): PriceBreakdown {
  const days = Math.floor(totalDays)
  if (!Number.isFinite(days) || days <= 0) return EMPTY

  const day = toCents(Number(rates.pricePerDay))
  if (!Number.isFinite(day) || day <= 0) return EMPTY

  // Пакет учитываем, только если он назначен и положителен. Пакет дороже
  // того же срока по дням допустим — перебор его просто не выберет.
  const packs: Array<{ size: number; cost: number; kind: 'week' | 'pack3' }> = []
  const week = toCents(Number(rates.priceWeek ?? 0))
  if (Number.isFinite(week) && week > 0) packs.push({ size: 7, cost: week, kind: 'week' })
  const three = toCents(Number(rates.price3Days ?? 0))
  if (Number.isFinite(three) && three > 0) packs.push({ size: 3, cost: three, kind: 'pack3' })

  // best[d] — минимальная стоимость ровно d дней; from[d] — чем закрыли хвост.
  const best = new Array<number>(days + 1).fill(Number.POSITIVE_INFINITY)
  const from = new Array<'day' | 'week' | 'pack3'>(days + 1).fill('day')
  best[0] = 0

  for (let d = 1; d <= days; d++) {
    best[d] = best[d - 1] + day
    from[d] = 'day'

    for (const p of packs) {
      // `max(0, …)` намеренно: пакет длиннее остатка разрешён целиком —
      // неделя за 70 дешевле пяти дней по 15, и человек вправе её взять.
      const rest = Math.max(0, d - p.size)
      const candidate = best[rest] + p.cost
      if (candidate < best[d]) {
        best[d] = candidate
        from[d] = p.kind
      }
    }
  }

  let weeks = 0
  let packs3 = 0
  let singleDays = 0
  for (let d = days; d > 0; ) {
    const step = from[d]
    if (step === 'week') { weeks++; d = Math.max(0, d - 7) }
    else if (step === 'pack3') { packs3++; d = Math.max(0, d - 3) }
    else { singleDays++; d -= 1 }
  }

  return { total: fromCents(best[days]), weeks, packs3, days: singleDays }
}
