// src/domain/renterUpdates.ts
//
// ЧТО ПРОИСХОДИТ С МОИМИ ЗАЯВКАМИ — взгляд арендатора.
//
// ── ПОЧЕМУ ЭТО НЕ «ДЕЛА» ─────────────────────────────────────────────
//
// У владельца есть ДЕЛА: заявка ждёт ответа, вещь пора отдать, возврат
// пора принять — и каждое закрывается его же нажатием (src/domain/
// ownerTasks.ts). У арендатора таких нет, и это свойство продукта, а не
// упущение: по таблице переходов transition-booking все действия после
// принятия заявки принадлежат владельцу.
//
// Арендатору нужно другое — ЗНАТЬ, ЧТО ДАЛЬШЕ. Ответили ли. Когда
// забирать. Когда возвращать. Сегодня он видит плоский список карточек,
// где отменённая полгода назад бронь выглядит ровно так же, как та, по
// которой сегодня надо приехать за дрелью.
//
// ── ПОЧЕМУ ЗДЕСЬ НЕТ ЗНАЧКА В НАВИГАЦИИ ──────────────────────────────
//
// Значок означает «кто-то ждёт твоего хода», и его ценность держится на
// одном: он обязан ОБНУЛЯТЬСЯ. «Забрать сегодня» снимается не
// арендатором, а владельцем — тем, что он нажмёт «передана». Если
// владелец забудет, у арендатора значок повиснет навсегда, и через
// неделю он перестанет его замечать. Поэтому «что дальше» живёт на
// экране, где ему место, а не в кружке.
//
// ── ЧТО ТАКОЕ «ЖИВАЯ» БРОНЬ ──────────────────────────────────────────
//
// Та, у которой есть будущее: ждёт ответа, принята, идёт. Отменённая,
// отклонённая, сгоревшая и завершённая будущего не имеют — они история.
// Это различие нужно не для красоты: счётчик на вкладке до сих пор
// показывал ЧИСЛО СТРОК ЗА ВСЁ ВРЕМЯ и не уменьшался никогда, сколько бы
// сделок ни закрылось.

import { answerDeadline, isUrgent, type RequestDeadline } from './requestDeadline'
import { toISODate } from './availability'

export type RenterUpdateKind =
  /** Заявка отправлена, владелец ещё не ответил. Окно — 24 часа. */
  | 'awaiting_answer'
  /** Приняли. День начала ещё не наступил. */
  | 'accepted'
  /** День начала наступил: пора забирать, владелец ждёт. */
  | 'pickup_due'
  /** Вещь на руках, срок ещё не вышел. */
  | 'in_progress'
  /** Срок вышел: пора вернуть. */
  | 'return_due'

/** Бронь в том виде, в каком её отдаёт useRentals. */
export interface RenterBooking {
  readonly id: string
  readonly status: string | null
  readonly start_date: string | null
  readonly end_date: string | null
  readonly created_at: string | null
}

export interface RenterUpdate {
  readonly kind: RenterUpdateKind
  readonly bookingId: string
  /** Только у 'awaiting_answer': то же окно, что видит владелец. */
  readonly deadline?: RequestDeadline
  /** Дней просрочки: 0 — наступило сегодня. Только у *_due. */
  readonly overdueDays: number
  /** Требует внимания прямо сейчас. */
  readonly urgent: boolean
}

/**
 * Насколько день `date` в прошлом относительно `today`.
 *
 * Сравнение строками YYYY-MM-DD, а не датами: день начала — это
 * календарный день без времени, и временные метки сдвинули бы его на
 * величину часового пояса. Подробнее — в ownerTasks.ts, там же разбор,
 * почему это ловится только замером.
 */
const daysPast = (date: string | null, today: string): number => {
  if (!date || date > today) return -1
  if (date === today) return 0
  const ms = Date.parse(`${today}T00:00:00`) - Date.parse(`${date}T00:00:00`)
  return Number.isNaN(ms) ? -1 : Math.round(ms / 86_400_000)
}

/**
 * Что дальше по одной брони — или ничего, если у неё нет будущего.
 *
 * `now` передаётся, а не берётся изнутри: функция обязана проверяться
 * без подмены часов процесса.
 */
export const updateFor = (booking: RenterBooking, now: Date): RenterUpdate | null => {
  const today = toISODate(now)

  switch (booking.status) {
    case 'pending_approval': {
      // Срок тот же, что у владельца: окно назначает крон expire-bookings,
      // и считать его здесь вторым способом значило бы показать двум
      // сторонам разные числа по одной и той же заявке.
      const deadline = answerDeadline(booking.created_at ?? null, now)
      return {
        kind: 'awaiting_answer',
        bookingId: booking.id,
        deadline,
        overdueDays: 0,
        urgent: isUrgent(deadline),
      }
    }

    case 'confirmed': {
      const past = daysPast(booking.start_date, today)
      if (past < 0) {
        return { kind: 'accepted', bookingId: booking.id, overdueDays: 0, urgent: false }
      }
      // Владелец ждёт. Чем дольше — тем хуже: его вещь числится занятой.
      return { kind: 'pickup_due', bookingId: booking.id, overdueDays: past, urgent: true }
    }

    case 'active': {
      const past = daysPast(booking.end_date, today)
      if (past < 0) {
        return { kind: 'in_progress', bookingId: booking.id, overdueDays: 0, urgent: false }
      }
      return { kind: 'return_due', bookingId: booking.id, overdueDays: past, urgent: true }
    }

    // У этих будущего нет. Перечислены поимённо, а не отданы `default`,
    // чтобы новое значение в enum booking_status заметил человек.
    case 'completed':
    case 'cancelled':
    case 'rejected':
    case 'expired':
    case 'payment_expired':
    case 'pending_payment':
    case 'disputed':
      return null

    default:
      // Незнакомый статус не выдумывает будущего и не роняет экран.
      return null
  }
}

/** Порядок при равной срочности: сначала то, что скорее сгорит. */
const KIND_ORDER: Record<RenterUpdateKind, number> = {
  return_due: 0,
  pickup_due: 1,
  awaiting_answer: 2,
  in_progress: 3,
  accepted: 4,
}

/** Всё живое, в порядке «чем скорее, тем выше». */
export const renterUpdates = (bookings: readonly RenterBooking[], now: Date): RenterUpdate[] =>
  bookings
    .map((b) => updateFor(b, now))
    .filter((u): u is RenterUpdate => u !== null)
    .sort((a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      b.overdueDays - a.overdueDays)

/**
 * Сколько броней ещё живо.
 *
 * Это число показывает вкладка. До 22.09 там стояло `userRentals.length`
 * — число строк за всё время, включая отменённые и завершённые. Такой
 * счётчик не уменьшается никогда: закрыв десять сделок, человек видит
 * «10» и не понимает, что от него хотят.
 */
export const liveRenterCount = (bookings: readonly RenterBooking[], now: Date): number =>
  renterUpdates(bookings, now).length
