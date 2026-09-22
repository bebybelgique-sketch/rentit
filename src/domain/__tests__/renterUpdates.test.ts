import { describe, it, expect } from 'vitest'
import { updateFor, renterUpdates, liveRenterCount, type RenterBooking } from '../renterUpdates'
import { BOOKING_STATUSES } from '../catalog'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Инварианты «что дальше» для арендатора.
 *
 * Проверяются свойства, которые обязаны держаться на ЛЮБЫХ данных, а не
 * отдельные придуманные случаи: сценарий ловит то, что придумал автор.
 */

const NOW = new Date('2026-09-22T12:00:00+02:00')
const TODAY = '2026-09-22'

const booking = (over: Partial<RenterBooking> = {}): RenterBooking => ({
  id: 'b1',
  status: 'pending_approval',
  start_date: null,
  end_date: null,
  created_at: NOW.toISOString(),
  ...over,
})

describe('живое отличается от истории', () => {
  it('заявка без ответа — живая, и у неё виден срок', () => {
    const u = updateFor(booking({ status: 'pending_approval' }), NOW)
    expect(u?.kind).toBe('awaiting_answer')
    // Тот же срок, что видит владелец: считать его двумя способами
    // значило бы показать сторонам разные числа по одной заявке.
    expect(u?.deadline).toBeDefined()
  })

  it('принятая бронь на будущее — живая, но не срочная', () => {
    const u = updateFor(booking({ status: 'confirmed', start_date: '2026-10-10' }), NOW)
    expect(u?.kind).toBe('accepted')
    expect(u?.urgent).toBe(false)
  })

  it('день начала наступил — забрать, и это срочно', () => {
    const u = updateFor(booking({ status: 'confirmed', start_date: TODAY }), NOW)
    expect(u?.kind).toBe('pickup_due')
    expect(u?.urgent).toBe(true)
    expect(u?.overdueDays).toBe(0)
  })

  it('срок вышел — вернуть, с числом дней просрочки', () => {
    const u = updateFor(booking({ status: 'active', end_date: '2026-09-19' }), NOW)
    expect(u?.kind).toBe('return_due')
    expect(u?.overdueDays).toBe(3)
    expect(u?.urgent).toBe(true)
  })

  it('идущая аренда, срок не вышел — живая, не срочная', () => {
    const u = updateFor(booking({ status: 'active', end_date: '2026-09-30' }), NOW)
    expect(u?.kind).toBe('in_progress')
    expect(u?.urgent).toBe(false)
  })

  /**
   * ГЛАВНОЕ РАЗЛИЧЕНИЕ. Именно на нём ломался счётчик вкладки: он
   * показывал ЧИСЛО СТРОК ЗА ВСЁ ВРЕМЯ и не уменьшался никогда.
   */
  it.each(['completed', 'cancelled', 'rejected', 'expired', 'payment_expired', 'disputed', 'pending_payment'])(
    'статус %s будущего не имеет',
    (status) => {
      expect(updateFor(booking({ status, start_date: '2026-01-01', end_date: '2026-01-05' }), NOW)).toBeNull()
    },
  )

  it('незнакомый статус не выдумывает будущего', () => {
    expect(updateFor(booking({ status: 'нечто_новое' }), NOW)).toBeNull()
    expect(updateFor(booking({ status: null }), NOW)).toBeNull()
  })

  it('каждый статус справочника разобран поимённо', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'domain', 'renterUpdates.ts'), 'utf8')
    const unhandled = BOOKING_STATUSES
      .map((s) => s.value)
      .filter((v) => !source.includes(`case '${v}'`))
    expect(
      unhandled,
      `статус есть в справочнике, но не разобран:\n  ${unhandled.join('\n  ')}`,
    ).toEqual([])
  })
})

describe('часовой пояс', () => {
  /**
   * `new Date('2026-09-22')` — полночь UTC, то есть 02:00 в Брюсселе.
   * Сравнение временными метками сдвинуло бы «сегодня» на два часа, и
   * «забрать сегодня» исчезало бы ночью — ровно тогда, когда человек
   * проверяет перед выходом.
   */
  it('в час ночи по Брюсселю день начала уже наступил', () => {
    const night = new Date('2026-09-22T01:00:00+02:00')
    expect(updateFor(booking({ status: 'confirmed', start_date: '2026-09-22' }), night)?.kind)
      .toBe('pickup_due')
  })

  it('в 23:30 завтрашняя бронь ещё не «забрать»', () => {
    const late = new Date('2026-09-22T23:30:00+02:00')
    expect(updateFor(booking({ status: 'confirmed', start_date: '2026-09-23' }), late)?.kind)
      .toBe('accepted')
  })

  it('без даты начала принятая бронь не зовёт забирать', () => {
    // Выдуманный призыв хуже пропущенного: человек поедет впустую.
    expect(updateFor(booking({ status: 'confirmed', start_date: null }), NOW)?.kind).toBe('accepted')
  })
})

describe('порядок и счёт', () => {
  const many: RenterBooking[] = [
    booking({ id: 'later', status: 'confirmed', start_date: '2026-12-01' }),
    booking({ id: 'pickup', status: 'confirmed', start_date: TODAY }),
    booking({ id: 'done', status: 'completed' }),
    booking({ id: 'cancelled', status: 'cancelled' }),
    booking({ id: 'overdue', status: 'active', end_date: '2026-09-15' }),
    booking({ id: 'waiting', status: 'pending_approval', created_at: NOW.toISOString() }),
  ]

  it('история в список не попадает', () => {
    const ids = renterUpdates(many, NOW).map((u) => u.bookingId)
    expect(ids).not.toContain('done')
    expect(ids).not.toContain('cancelled')
  })

  it('возврат с просрочкой идёт первым', () => {
    expect(renterUpdates(many, NOW)[0].bookingId).toBe('overdue')
  })

  it('срочное выше несрочного', () => {
    const list = renterUpdates(many, NOW)
    const firstCalm = list.findIndex((u) => !u.urgent)
    if (firstCalm !== -1) {
      expect(list.slice(firstCalm).every((u) => !u.urgent)).toBe(true)
    }
  })

  it('счётчик вкладки равен длине списка', () => {
    expect(liveRenterCount(many, NOW)).toBe(renterUpdates(many, NOW).length)
  })

  /**
   * То, ради чего счётчик переделан: закрыв все сделки, человек обязан
   * увидеть ноль, а не «сколько их было за всё время».
   */
  it('когда всё закрыто — ноль, а не число строк', () => {
    const closed = many.map((b) => ({ ...b, status: 'completed' }))
    expect(closed).toHaveLength(6)
    expect(liveRenterCount(closed, NOW)).toBe(0)
  })
})
