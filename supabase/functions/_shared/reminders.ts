// Напоминания: push по строкам, которые поставила база.
//
// ── КТО ЧТО ДЕЛАЕТ ──────────────────────────────────────────────────
//
// Решает, КОМУ и О ЧЁМ напомнить, функция базы queue_booking_reminders
// (миграция 57). Она же пишет строку ленты и возвращает только то, что
// поставила сейчас. Повторный вызов в том же окне ничего не вернёт:
// notifications_once держит одну строку на (человек, вид, бронь). Поэтому
// второго push по тому же напоминанию не будет, сколько бы раз ни звали
// планировщик.
//
// Здесь — только доставка на устройства, теми же средствами, что у
// событий брони (push.ts). Ленте push не нужен: строка уже записана.
//
// ── ПОЧТА ───────────────────────────────────────────────────────────
//
// Писем нет, пока нет ключа Resend. Когда он появится, письмо встаёт
// рядом с push здесь же, по тем же строкам: решать «кому» второй раз не
// придётся.

import { pushToUser, type PushDeps } from './push.ts'
import type { PushFacts, PushKind } from './pushCopy.ts'

export const REMINDER_KINDS = ['request_reminder', 'return_tomorrow', 'return_unconfirmed'] as const
export type ReminderKind = typeof REMINDER_KINDS[number]

export const isReminderKind = (value: unknown): value is ReminderKind =>
  typeof value === 'string' && (REMINDER_KINDS as readonly string[]).includes(value)

/** Строка, которую вернула queue_booking_reminders. */
export interface QueuedReminder {
  readonly user_id: string
  readonly kind: string
  readonly booking_id: string
}

/** Бронь в том виде, в каком её читает expire-bookings для текста. */
export interface ReminderBooking {
  readonly id: string
  readonly start_date: string | null
  readonly end_date: string | null
  readonly total_price: number | string | null
  readonly itemTitle: string | null
  readonly ownerName: string | null
  readonly renterName: string | null
}

/**
 * Факты для текста. Имя второй стороны — по виду напоминания, как у событий:
 * владельцу о заявке и о возврате называется арендатор (otherName),
 * арендатору о возврате — владелец (ownerName).
 */
export function reminderFacts(b: ReminderBooking): PushFacts {
  return {
    itemTitle: b.itemTitle,
    ownerName: b.ownerName,
    otherName: b.renterName,
    startDate: b.start_date,
    endDate: b.end_date,
    totalPrice: b.total_price,
  }
}

export interface ReminderReport {
  /** Напоминаний, по которым пробовали отправить push. */
  readonly attempted: number
  /** Устройств, до которых push дошёл. */
  readonly delivered: number
  /** Напоминаний без push: бронь не прочиталась или вид чужой. */
  readonly skipped: number
}

/**
 * Push по поставленным напоминаниям. Не бросает: строки ленты уже
 * записаны, и сбой доставки не должен ронять работу планировщика.
 */
export async function pushReminders(
  deps: PushDeps,
  queued: readonly QueuedReminder[],
  bookings: ReadonlyMap<string, ReminderBooking>,
): Promise<ReminderReport> {
  const log = deps.log ?? ((line: string) => console.log(line))
  let attempted = 0, delivered = 0, skipped = 0

  for (const r of queued) {
    const booking = bookings.get(r.booking_id)
    if (!isReminderKind(r.kind) || !booking) {
      skipped++
      log(`[reminders] ${r.kind}: ${booking ? 'вид не из списка напоминаний' : 'бронь не прочиталась'} — без push`)
      continue
    }
    const report = await pushToUser(deps, r.user_id, r.kind as PushKind, reminderFacts(booking), r.booking_id)
    attempted++
    delivered += report.sent
  }

  return { attempted, delivered, skipped }
}
