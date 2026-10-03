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
// пакет «3 дня», «неделя» и «выходные». Мы подбираем самое дешёвое сочетание
// пакетов и одиночных дней — перебором по дням, а не жадно: жадный выбор на
// наборе 12/40/70 даёт для 9 дней 70+40 = 110, тогда как 70+2×12 = 94.
//
// Из правила следует свойство, которое и нужно человеку: арендатор НИКОГДА
// не платит больше, чем по дневной цене, и пакет короче срока не мешает —
// пятидневная аренда возьмёт недельный пакет, если он дешевле пяти дней.
//
// ВЫХОДНЫЕ — ПО БЕЛЬГИЙСКОМУ ПРАВИЛУ BOELS (сверено 03.10.2026):
//   «Le tarif week-end (samedi – lundi) … durée maximale de 48 heures …
//   une seule fois le tarif journalier»; «vendredi – lundi» — до 72 часов,
//   ДВА дневных тарифа.
// То есть пакет — это суббота и воскресенье с возвратом в понедельник
// утром; пятница сверх него — ещё один день. Часов в брони у нас нет, только
// даты, поэтому пакет закрывает отрезок сб–вс или сб–пн, а пятница считается
// отдельно: пт–пн = день + пакет — ровно Boels, если владелец назначил пакет
// по цене дня.
//
// До 03.10 (#150) правило было по образцу Kiloutou — «retrait vendredi 14–16
// h, retour lundi 10–12 h, payez 1 jour et demi»: пакет закрывал и пт–вс, и
// пт–пн. Но у Kiloutou часы: пятница у них — вторая половина дня, а у нас
// бронь на пятницу — весь день, и владелец терял её даром. Внешнее ревью
// (GPT, 03.10) назвало это прямо: «пакет не может покрывать будни
// бесплатно». Понедельник утром в пакет входит — так у обоих прокатчиков.
//
// Цену пакета назначает владелец, мы ничего не умножаем за него. В отличие
// от недели и трёхдневки, пакет выходных привязан к календарю и за пределы
// брони не выходит: одна суббота — это один день, вс–пн — два.

export type RentalRates = {
  pricePerDay: number
  /** Цена за пакет из трёх дней. `null` — владелец такого тарифа не назначил. */
  price3Days?: number | null
  /** Цена за пакет из семи дней. */
  priceWeek?: number | null
  /** Цена за выходные: сб–вс или сб–пн (возврат в понедельник). */
  priceWeekend?: number | null
}

export type PriceBreakdown = {
  /** Итог к оплате владельцу наличными, в евро. */
  total: number
  /** Сколько недельных пакетов вошло в итог. */
  weeks: number
  /** Сколько трёхдневных пакетов вошло в итог. */
  packs3: number
  /** Сколько пакетов «выходные» вошло в итог. */
  weekends: number
  /** Сколько дней осталось по дневной цене. */
  days: number
}

/** Деньги считаем в центах: 0.1 + 0.2 в двоичной дроби даёт 0.30000000000000004. */
const toCents = (v: number) => Math.round(v * 100)
const fromCents = (c: number) => c / 100

const EMPTY: PriceBreakdown = { total: 0, weeks: 0, packs3: 0, weekends: 0, days: 0 }

const SUNDAY = 0
const MONDAY = 1

/**
 * День недели для `offset`-го дня брони: 0 — воскресенье … 6 — суббота.
 * Через Date.UTC — без часов и поясов: «какой это день» не зависит от того,
 * где открыта страница.
 */
const weekdayAt = (startISO: string, offset: number): number => {
  const [y, m, d] = startISO.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + offset)).getUTCDay()
}

/**
 * Длины отрезков «выходные», которые кончаются в этот день недели:
 * в воскресенье — сб–вс (2), в понедельник — сб–пн (3). Оба начинаются в
 * субботу; пятница в пакет не входит.
 */
const weekendLengthsEndingOn = (weekday: number): number[] =>
  weekday === SUNDAY ? [2] : weekday === MONDAY ? [3] : []

/**
 * Возвращает самое дешёвое сочетание тарифов на `totalDays` дней.
 *
 * `startISO` — первый день брони (YYYY-MM-DD). Без него пакет выходных не
 * рассматривается: неизвестно, на какие дни недели падает срок.
 *
 * Некорректная дневная цена (ноль, отрицательная, NaN) — не наше дело
 * поправлять: возвращаем нули, а отказ выдаёт вызывающая сторона, у которой
 * есть чем ответить человеку.
 */
export function computeRentalPrice(rates: RentalRates, totalDays: number, startISO?: string): PriceBreakdown {
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

  const weekendCost = toCents(Number(rates.priceWeekend ?? 0))
  const weekends = Number.isFinite(weekendCost) && weekendCost > 0 &&
    typeof startISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startISO)

  // best[d] — минимальная стоимость первых d дней брони; from[d] — чем
  // закрыли хвост, span[d] — сколько дней закрыл пакет выходных.
  const best = new Array<number>(days + 1).fill(Number.POSITIVE_INFINITY)
  const from = new Array<'day' | 'week' | 'pack3' | 'weekend'>(days + 1).fill('day')
  const span = new Array<number>(days + 1).fill(0)
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

    if (weekends) {
      // d-й день брони — это день с отступом d − 1 от начала.
      for (const len of weekendLengthsEndingOn(weekdayAt(startISO!, d - 1))) {
        if (d - len < 0) continue
        const candidate = best[d - len] + weekendCost
        if (candidate < best[d]) {
          best[d] = candidate
          from[d] = 'weekend'
          span[d] = len
        }
      }
    }
  }

  let weeksUsed = 0
  let packs3 = 0
  let weekendsUsed = 0
  let singleDays = 0
  for (let d = days; d > 0; ) {
    const step = from[d]
    if (step === 'week') { weeksUsed++; d = Math.max(0, d - 7) }
    else if (step === 'pack3') { packs3++; d = Math.max(0, d - 3) }
    else if (step === 'weekend') { weekendsUsed++; d -= span[d] }
    else { singleDays++; d -= 1 }
  }

  return { total: fromCents(best[days]), weeks: weeksUsed, packs3, weekends: weekendsUsed, days: singleDays }
}
