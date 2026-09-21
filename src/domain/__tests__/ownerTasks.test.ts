import { describe, it, expect } from 'vitest'
import { taskFor, ownerTasks, ownerTaskCount, type TaskBooking } from '../ownerTasks'
import { BOOKING_STATUSES } from '../catalog'

/**
 * Инварианты счётчика дел.
 *
 * Проверяется не «на такой-то брони выходит такая-то надпись», а свойства,
 * которые обязаны держаться на ЛЮБЫХ данных. Сценарий ловит тот случай,
 * который придумал автор; инвариант ловит и тот, которого он не придумал.
 */

const NOW = new Date('2026-09-21T12:00:00+02:00')
const TODAY = '2026-09-21'

const booking = (over: Partial<TaskBooking> = {}): TaskBooking => ({
  id: 'b1',
  status: 'pending_approval',
  start_date: null,
  end_date: null,
  created_at: NOW.toISOString(),
  ...over,
})

describe('дело есть только там, где ждут хода владельца', () => {
  it('заявка — дело', () => {
    expect(taskFor(booking({ status: 'pending_approval' }), NOW)?.kind).toBe('answer')
  })

  it('подтверждённая бронь, день начала наступил — дело', () => {
    const t = taskFor(booking({ status: 'confirmed', start_date: TODAY }), NOW)
    expect(t?.kind).toBe('handover')
    expect(t?.overdueDays).toBe(0)
  })

  it('идущая аренда, срок кончился — дело', () => {
    const t = taskFor(booking({ status: 'active', end_date: '2026-09-19' }), NOW)
    expect(t?.kind).toBe('complete')
    expect(t?.overdueDays).toBe(2)
  })

  /**
   * Главный инвариант счётчика: он обязан УМЕТЬ обнуляться. Счётчик, у
   * которого есть слагаемое, не уходящее никогда, через неделю перестаёт
   * значить что-либо — к красному кружку привыкают.
   */
  it('завершённая аренда делом НЕ становится: отзыв никого не держит', () => {
    expect(taskFor(booking({ status: 'completed', end_date: '2026-09-01' }), NOW)).toBeNull()
  })

  it('подтверждённая бронь на будущее — не дело сегодня', () => {
    expect(taskFor(booking({ status: 'confirmed', start_date: '2026-10-15' }), NOW)).toBeNull()
  })

  it('идущая аренда, срок ещё не вышел — не дело', () => {
    expect(taskFor(booking({ status: 'active', end_date: '2026-09-25' }), NOW)).toBeNull()
  })

  it.each(['cancelled', 'rejected', 'expired', 'payment_expired', 'disputed', 'pending_payment'])(
    'статус %s делом не становится никогда',
    (status) => {
      expect(taskFor(booking({ status, start_date: '2026-01-01', end_date: '2026-01-02' }), NOW)).toBeNull()
    },
  )

  it('неизвестный статус не создаёт дела и не роняет счёт', () => {
    expect(taskFor(booking({ status: 'нечто_новое' }), NOW)).toBeNull()
    expect(taskFor(booking({ status: null }), NOW)).toBeNull()
  })

  /**
   * Связь со схемой. Если в enum `booking_status` появится значение, а
   * сюда его не внесут, оно молча попадёт в `default` и дела не создаст.
   * Иногда это верно, иногда нет — но решать обязан человек.
   */
  it('каждый статус из справочника разобран поимённо', () => {
    const source = readOwnerTasksSource()
    const unhandled = BOOKING_STATUSES
      .map((s) => s.value)
      .filter((v) => !source.includes(`case '${v}'`))
    expect(
      unhandled,
      `статус есть в справочнике, но не разобран в ownerTasks:\n  ${unhandled.join('\n  ')}\n` +
        `решите явно, ждёт ли он хода владельца`,
    ).toEqual([])
  })
})

describe('срочность', () => {
  it('заявка, у которой вышел срок, — срочная', () => {
    const old = new Date(NOW.getTime() - 25 * 3600_000).toISOString()
    const t = taskFor(booking({ status: 'pending_approval', created_at: old }), NOW)
    expect(t?.urgent).toBe(true)
    expect(t?.deadline?.state).toBe('overdue')
  })

  it('свежая заявка — не срочная', () => {
    const t = taskFor(booking({ status: 'pending_approval', created_at: NOW.toISOString() }), NOW)
    expect(t?.urgent).toBe(false)
  })

  /**
   * Просроченный возврат срочен в тот же день, а не «через пару дней»:
   * вещь числится занятой, и следующая заявка на неё упрётся в занятые
   * даты. Молчание здесь стоит не вежливости, а второй аренды.
   */
  it('возврат срочен с первого дня просрочки', () => {
    expect(taskFor(booking({ status: 'active', end_date: TODAY }), NOW)?.urgent).toBe(true)
  })

  it('срок ответа есть ТОЛЬКО у заявки', () => {
    expect(taskFor(booking({ status: 'confirmed', start_date: TODAY }), NOW)?.deadline).toBeUndefined()
    expect(taskFor(booking({ status: 'active', end_date: TODAY }), NOW)?.deadline).toBeUndefined()
    expect(taskFor(booking({ status: 'pending_approval' }), NOW)?.deadline).toBeDefined()
  })
})

describe('день начала считается в поясе человека, а не в UTC', () => {
  /**
   * `new Date('2026-09-21')` — это полночь UTC, то есть 02:00 в Брюсселе
   * летом. Владелец, открывший приложение в час ночи 21-го, по UTC живёт
   * ещё в 20-м. Сравнение временных меток объявило бы день начала
   * ненаступившим, и дело исчезло бы ровно в ту ночь, когда оно возникло.
   */
  it('в час ночи по Брюсселю бронь на сегодня уже дело', () => {
    const night = new Date('2026-09-21T01:00:00+02:00')
    expect(taskFor(booking({ status: 'confirmed', start_date: '2026-09-21' }), night)?.kind)
      .toBe('handover')
  })

  it('в 23:30 бронь на завтра делом ещё не стала', () => {
    const late = new Date('2026-09-21T23:30:00+02:00')
    expect(taskFor(booking({ status: 'confirmed', start_date: '2026-09-22' }), late)).toBeNull()
  })

  it('без даты начала передача делом не становится', () => {
    // Выдуманное дело хуже пропущенного: человек пойдёт нажимать кнопку,
    // за которой ничего нет.
    expect(taskFor(booking({ status: 'confirmed', start_date: null }), NOW)).toBeNull()
  })
})

describe('порядок и счёт', () => {
  const many: TaskBooking[] = [
    booking({ id: 'future', status: 'confirmed', start_date: '2026-12-01' }),
    booking({ id: 'handover', status: 'confirmed', start_date: TODAY }),
    booking({ id: 'done', status: 'completed' }),
    booking({ id: 'overdue-return', status: 'active', end_date: '2026-09-10' }),
    booking({ id: 'fresh-request', status: 'pending_approval', created_at: NOW.toISOString() }),
  ]

  it('в список попадают только настоящие дела', () => {
    expect(ownerTasks(many, NOW).map((t) => t.bookingId))
      .toEqual(expect.not.arrayContaining(['future', 'done']))
  })

  it('срочное идёт выше несрочного', () => {
    const order = ownerTasks(many, NOW)
    const firstNotUrgent = order.findIndex((t) => !t.urgent)
    if (firstNotUrgent !== -1) {
      expect(order.slice(firstNotUrgent).every((t) => !t.urgent)).toBe(true)
    }
  })

  /**
   * Счётчик в навигации и список на экране обязаны считаться ОДНИМ
   * способом. Два способа — это «3» в кружке и две строки под ним.
   */
  it('число в значке равно длине списка', () => {
    expect(ownerTaskCount(many, NOW)).toBe(ownerTasks(many, NOW).length)
  })

  it('без броней дел нет', () => {
    expect(ownerTaskCount([], NOW)).toBe(0)
  })

  it('счёт обнуляем: когда всё закрыто, в значке ноль', () => {
    const closed = many.map((b) => ({ ...b, status: 'completed' }))
    expect(ownerTaskCount(closed, NOW)).toBe(0)
  })
})

/** Исходник домена — для проверки полноты разбора статусов. */
function readOwnerTasksSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  return readFileSync(join(process.cwd(), 'src', 'domain', 'ownerTasks.ts'), 'utf8')
}
