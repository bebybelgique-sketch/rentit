// supabase/functions/_shared/availability.ts
//
// Доступность вещи: КАК её спрашивают и КАК читают ответ.
//
// ЗАЧЕМ файл лежит здесь, а не в `src/domain/`. Ровно та же причина, что у
// соседнего `pricing.ts`: правило нужно обеим сторонам. Браузер обязан
// показать календарь до нажатия кнопки, сервер обязан отказать при записи.
// Две реализации одного правила разошлись бы молча — и человек увидел бы
// свободный день, а получил отказ.
//
// На 17.08.2026 занятость считалась в ПЯТИ местах и они уже разошлись
// (триггер не считал занятым pending_payment, витрина считала). Теперь
// правило живёт в базе — функции `unavailable_days` и `item_earliest_start`
// (миграция 20260817000022), — а этот файл только спрашивает и толкует
// ответ. Своей арифметики пересечений здесь нет и быть не должно.
//
// Файл намеренно чистый: ни Deno, ни сети, ни импорта supabase-js. Клиента
// передают снаружи одной функцией `rpc`, поэтому модуль одинаково
// собирается и в браузерный бандл, и в Deno.

/** Почему день недоступен. Список задаёт база, здесь он только назван. */
export type UnavailableReason = 'booked' | 'blocked'

export interface UnavailableDay {
  day: string // YYYY-MM-DD
  reason: UnavailableReason
}

export interface ItemCalendar {
  /** Самая ранняя дата начала: сегодня плюс срок предупреждения владельца. */
  earliestStart: string
  /** Сколько одинаковых единиц у вещи. */
  quantity: number
  /** Дни, в которые вещь взять нельзя, — уже посчитанные базой. */
  unavailable: Map<string, UnavailableReason>
}

/**
 * Как обратиться к базе. Именно функция, а не клиент: у браузерного
 * supabase-js и у серверного разные типы, но одинаковый вызов, и
 * подмешивать сюда ни один из них не нужно.
 */
export type RpcCaller = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>

// --- Даты. Строки YYYY-MM-DD, а не Date ------------------------------
//
// Тип Date несёт время и часовой пояс, а бронь измеряется сутками. Именно
// на этом 12.08 сломалась бронь «на сегодня»: `new Date('2026-08-12')` —
// полночь UTC, и сравнение с моментом резало весь текущий день. Строки
// YYYY-MM-DD сравниваются лексикографически в том же порядке, что и даты.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return toISODate(dt)
}

/** Все дни отрезка включительно. Порядок гарантирован, пустой при start > end. */
export function daysBetween(startISO: string, endISO: string): string[] {
  const out: string[] = []
  let cur = startISO
  // Потолок на случай мусора на входе: год перебора вместо бесконечного.
  for (let i = 0; cur <= endISO && i <= 366; i++) {
    out.push(cur)
    cur = addDaysISO(cur, 1)
  }
  return out
}

// --- Толкование ответа -----------------------------------------------

/**
 * Первый недоступный день отрезка — или `null`, если весь отрезок свободен.
 * Возвращается именно день, а не «да/нет»: человеку надо сказать, какой
 * именно день мешает, иначе он тыкает наугад.
 */
export function firstUnavailableDay(
  cal: Pick<ItemCalendar, 'unavailable'>,
  startISO: string,
  endISO: string,
): string | null {
  for (const day of daysBetween(startISO, endISO)) {
    if (cal.unavailable.has(day)) return day
  }
  return null
}

/** Можно ли НАЧАТЬ аренду в этот день: не раньше срока предупреждения. */
export function isTooSoon(cal: Pick<ItemCalendar, 'earliestStart'>, dayISO: string): boolean {
  return dayISO < cal.earliestStart
}

/**
 * Можно ли выбрать этот день в календаре. Один ответ на три причины:
 * прошедшая дата, слишком рано, день недоступен.
 */
export function isSelectable(cal: ItemCalendar, dayISO: string, todayISO: string): boolean {
  if (dayISO < todayISO) return false
  if (isTooSoon(cal, dayISO)) return false
  return !cal.unavailable.has(dayISO)
}

// --- Обращение к базе -------------------------------------------------

interface RawCalendar {
  earliest_start: string | null
  quantity: number | null
  days: { day: string; reason: string }[] | null
}

/** Разбор ответа `item_calendar`. Вынесен отдельно, чтобы его можно было проверить без базы. */
export function parseCalendar(raw: unknown, fallbackTodayISO: string): ItemCalendar {
  const r = (raw ?? {}) as Partial<RawCalendar>
  const unavailable = new Map<string, UnavailableReason>()
  for (const d of r.days ?? []) {
    if (!d?.day) continue
    unavailable.set(d.day, d.reason === 'blocked' ? 'blocked' : 'booked')
  }
  return {
    earliestStart: r.earliest_start ?? fallbackTodayISO,
    quantity: typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 1,
    unavailable,
  }
}

/**
 * Календарь вещи одним вызовом: недоступные дни, самый ранний старт и
 * количество единиц.
 *
 * При ошибке НЕ бросает, а отдаёт пустой календарь: молчащая база не
 * должна превращать страницу вещи в белый экран. Отказ всё равно поставит
 * триггер, если человек попробует занятые даты.
 */
export async function fetchItemCalendar(
  rpc: RpcCaller,
  itemId: string,
  fromISO: string,
  toISO: string,
): Promise<ItemCalendar> {
  const { data, error } = await rpc('item_calendar', {
    p_item_id: itemId,
    p_from: fromISO,
    p_to: toISO,
  })
  if (error) {
    console.error('item_calendar:', error)
    return { earliestStart: fromISO, quantity: 1, unavailable: new Map() }
  }
  return parseCalendar(data, fromISO)
}

export type RangeProblem =
  | { code: 'unavailable'; day: string }
  | { code: 'too_soon'; earliestStart: string }

/**
 * Свободен ли отрезок. Тот же вопрос, что задаёт календарь, — и тем же
 * вызовом. Отсюда его задаёт `request-rental`, чтобы ответить человеку
 * понятным отказом раньше, чем это сделает исключением триггер.
 */
export async function checkRangeAvailable(
  rpc: RpcCaller,
  itemId: string,
  startISO: string,
  endISO: string,
): Promise<RangeProblem | null> {
  const { data, error } = await rpc('item_calendar', {
    p_item_id: itemId,
    p_from: startISO,
    p_to: endISO,
  })
  // Ошибку сюда не проглатываем молча, но и не выдаём за занятость:
  // последнее слово всё равно за триггером.
  if (error) {
    console.error('item_calendar:', error)
    return null
  }
  const cal = parseCalendar(data, startISO)
  if (isTooSoon(cal, startISO)) {
    return { code: 'too_soon', earliestStart: cal.earliestStart }
  }
  const day = firstUnavailableDay(cal, startISO, endISO)
  return day ? { code: 'unavailable', day } : null
}
