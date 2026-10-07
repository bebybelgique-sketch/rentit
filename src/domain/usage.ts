// src/domain/usage.ts
//
// Сводка дневных счётчиков (таблица usage_counts, миграция 62) для /admin.
//
// Строки приходят как есть — день, событие, число, — а здесь считаются
// итоги «с первого дня» и «за 7 дней» и три доли пути человека. Чистая
// функция: проверяется тестом без сети и без базы.
//
// ЧЕСТНОСТЬ ЦИФР. Считаются только согласившиеся на «Analytique» в баннере
// (src/lib/usage.ts). Доли внутри этой выборки сопоставимы друг с другом;
// абсолютные числа меньше настоящего числа посетителей — и /admin говорит
// это рядом с ними.

export const USAGE_EVENTS = [
  'home_view',
  'hero_search',
  'browse_view',
  'browse_empty',
  'demand_sent',
  'listing_start',
] as const

export type UsageEventName = (typeof USAGE_EVENTS)[number]

export interface UsageRow {
  day: string // YYYY-MM-DD, сутки UTC
  event: string
  count: number
}

/**
 * Когда пересматривать первый экран — числом, а не датой: после стольких
 * открытий главной (у согласившихся). Число — точка пересмотра, а не
 * порог успеха: какие доли считать провалом, решает владелец продукта.
 */
export const FIRST_SCREEN_REVIEW_AT = 300

export interface UsageSummary {
  /** Первый день с данными или null, если строк нет. */
  since: string | null
  total: Record<UsageEventName, number>
  last7: Record<UsageEventName, number>
  /** Доли пути, null — делить не на что. */
  ratios: {
    homeToSearch: number | null
    browseEmpty: number | null
    emptyToDemand: number | null
  }
}

const zero = (): Record<UsageEventName, number> =>
  Object.fromEntries(USAGE_EVENTS.map((e) => [e, 0])) as Record<UsageEventName, number>

const isEvent = (e: string): e is UsageEventName => (USAGE_EVENTS as readonly string[]).includes(e)

/** День на шесть суток раньше `today` (UTC): окно «7 дней» включает сегодня. */
const weekStart = (today: string): string => {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

export function summarizeUsage(rows: readonly UsageRow[], today: string): UsageSummary {
  const total = zero()
  const last7 = zero()
  const from = weekStart(today)
  let since: string | null = null

  for (const r of rows) {
    if (!isEvent(r.event)) continue
    total[r.event] += r.count
    if (r.day >= from && r.day <= today) last7[r.event] += r.count
    if (since === null || r.day < since) since = r.day
  }

  return {
    since,
    total,
    last7,
    ratios: {
      homeToSearch: share(total.hero_search, total.home_view),
      browseEmpty: share(total.browse_empty, total.browse_view),
      emptyToDemand: share(total.demand_sent, total.browse_empty),
    },
  }
}
