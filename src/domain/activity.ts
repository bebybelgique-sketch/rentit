// src/domain/activity.ts
//
// Лента событий: из строки базы — в то, что видит человек.
//
// В таблице (миграция 42) ТЕКСТА НЕТ — только что за событие и о какой
// брони. Текст собирается здесь, при показе:
//   • на языке, выбранном СЕЙЧАС (сменил язык — сменилась и лента);
//   • из тех же фраз, что и push (supabase/functions/_shared/pushCopy.ts):
//     уведомление на экране блокировки и строка в ленте говорят одно и то же;
//   • из ТЕКУЩИХ данных брони: переименованная вещь показывается под новым
//     именем, а копии переписки в ленте не лежит.
//
// Файл без React и без сети — проверяется обычными тестами.

import { renderPush, type PushFacts, type PushKind, type PushLang } from './push'

/** Строка ленты в том виде, в каком её отдаёт запрос useActivityFeed. */
export interface ActivityRow {
  readonly id: string
  readonly kind: PushKind
  readonly booking_id: string
  readonly message_id: string | null
  readonly created_at: string
  readonly read_at: string | null
  readonly booking: {
    readonly start_date: string | null
    readonly end_date: string | null
    readonly total_price: number | string | null
    readonly renter_id: string | null
    readonly cancelled_by: string | null
    readonly item: { readonly title: string | null; readonly owner: { readonly full_name: string | null } | null } | null
    readonly renter: { readonly full_name: string | null } | null
  } | null
  readonly message: {
    readonly body: string | null
    readonly sender: { readonly full_name: string | null } | null
  } | null
}

/** Факты события — те же, что сервер кладёт в push. */
export function factsOf(row: ActivityRow): PushFacts {
  const b = row.booking
  const ownerName = b?.item?.owner?.full_name ?? null
  const renterName = b?.renter?.full_name ?? null
  const base: PushFacts = {
    itemTitle: b?.item?.title ?? null,
    ownerName,
    otherName: renterName,
    startDate: b?.start_date ?? null,
    endDate: b?.end_date ?? null,
    totalPrice: b?.total_price ?? null,
  }
  switch (row.kind) {
    case 'new_message':
      return { ...base, otherName: row.message?.sender?.full_name ?? null, messageBody: row.message?.body ?? null }
    case 'cancelled':
      // Имя — ОТМЕНИВШЕГО. Читает запись вторая сторона.
      return {
        ...base,
        otherName: b?.cancelled_by && b.cancelled_by === b.renter_id ? renterName : b?.cancelled_by ? ownerName : null,
      }
    default:
      return base
  }
}

export interface ActivityEntry {
  readonly id: string
  readonly kind: PushKind
  readonly bookingId: string
  readonly title: string
  readonly body: string
  readonly createdAt: string
  readonly unread: boolean
  /** Куда ведёт нажатие — туда же, куда push. */
  readonly href: string
}

export function toEntry(row: ActivityRow, lang: PushLang): ActivityEntry {
  const { title, body } = renderPush(row.kind, lang, factsOf(row))
  return {
    id: row.id,
    kind: row.kind,
    bookingId: row.booking_id,
    title,
    body,
    createdAt: row.created_at,
    unread: row.read_at === null,
    href: `/my-rentals?booking=${encodeURIComponent(row.booking_id)}`,
  }
}

export type DayGroup = 'today' | 'yesterday' | 'earlier'

const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** «Aujourd'hui / Hier / Plus tôt» — по МЕСТНОМУ дню читателя. */
export function dayGroupOf(createdAt: string, now: Date): DayGroup {
  const diff = Math.round((localDay(now) - localDay(new Date(createdAt))) / 86_400_000)
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : 'earlier'
}

/** Группы в порядке показа; пустых нет. Внутри — свежие сверху. */
export function groupByDay(entries: readonly ActivityEntry[], now: Date): Array<{ group: DayGroup; entries: ActivityEntry[] }> {
  const order: DayGroup[] = ['today', 'yesterday', 'earlier']
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return order
    .map((group) => ({ group, entries: sorted.filter((e) => dayGroupOf(e.createdAt, now) === group) }))
    .filter((g) => g.entries.length > 0)
}
