import { describe, it, expect, vi } from 'vitest'
import { pushReminders, reminderFacts, REMINDER_KINDS, type ReminderBooking } from '../reminders'
import { PUSH_KINDS, DELIVERY, renderPush } from '../pushCopy'
import type { PushDeps, StoredSubscription } from '../push'

/**
 * Напоминания (миграция 57): кому и о чём решает база, здесь — доставка.
 * Главное, что проверяется: каждый получает текст про СВОЮ роль, с именем
 * ВТОРОЙ стороны. Владельцу о заявке называется арендатор, арендатору о
 * возврате — владелец.
 */

const VAPID = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:x@example.org' }

const sub = (endpoint: string, lang: string): StoredSubscription => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${endpoint}`, p256dh: 'k', auth: 'a', lang,
})

const makeDeps = (subsByUser: Record<string, StoredSubscription[]>) => {
  const logs: string[] = []
  const sent: Array<{ endpoint: string; payload: any; opts: any }> = []
  const deps: PushDeps = {
    vapid: VAPID,
    listSubscriptions: async (u) => subsByUser[u] ?? [],
    removeSubscription: async () => {},
    send: vi.fn(async (target, payload, _v, opts) => {
      sent.push({ endpoint: target.endpoint, payload, opts })
      return { kind: 'sent', status: 201 } as const
    }),
    log: (l) => logs.push(l),
  }
  return { deps, logs, sent }
}

const BOOKING: ReminderBooking = {
  id: 'b-1',
  start_date: '2026-10-08',
  end_date: '2026-10-10',
  total_price: 240,
  itemTitle: 'Mini-pelle 1 t',
  ownerName: 'Ramzan Bekov',
  renterName: 'Rachel Locataire',
}
const BOOKINGS = new Map([[BOOKING.id, BOOKING]])

describe('напоминание — каждому про его роль', () => {
  it('заявка ждёт — владельцу, с именем арендатора и без обещания точного часа', async () => {
    const { deps, sent } = makeDeps({ owner: [sub('o', 'fr')] })
    await pushReminders(deps, [{ user_id: 'owner', kind: 'request_reminder', booking_id: 'b-1' }], BOOKINGS)
    expect(sent).toHaveLength(1)
    expect(sent[0].payload.title).toBe('Demande en attente : « Mini-pelle 1 t »')
    expect(sent[0].payload.body).toBe('Rachel L. · 8 → 10 oct. Sans réponse, elle expire dans quelques heures.')
    expect(sent[0].payload.url).toBe('/my-rentals?booking=b-1')
  })

  it('возврат завтра — арендатору, с именем владельца', async () => {
    const { deps, sent } = makeDeps({ renter: [sub('r', 'nl')] })
    await pushReminders(deps, [{ user_id: 'renter', kind: 'return_tomorrow', booking_id: 'b-1' }], BOOKINGS)
    expect(sent[0].payload.title).toBe('Morgen terug: „Mini-pelle 1 t"')
    // Точка инициала служит и точкой предложения — без «B..».
    expect(sent[0].payload.body).toBe('Terug naar Ramzan B. Spreek het uur af in het gesprek.')
  })

  it('возврат не отмечен — владельцу, с кнопкой, которая есть в продукте', async () => {
    const { deps, sent } = makeDeps({ owner: [sub('o', 'en')] })
    await pushReminders(deps, [{ user_id: 'owner', kind: 'return_unconfirmed', booking_id: 'b-1' }], BOOKINGS)
    expect(sent[0].payload.body).toBe('The rental with Rachel L. ended yesterday. Got the tool back? Tap "Mark returned".')
  })
})

describe('что не отправляется', () => {
  it('бронь не прочиталась — без push, с записью в лог', async () => {
    const { deps, sent, logs } = makeDeps({ owner: [sub('o', 'fr')] })
    const report = await pushReminders(deps, [{ user_id: 'owner', kind: 'request_reminder', booking_id: 'gone' }], BOOKINGS)
    expect(sent).toHaveLength(0)
    expect(report).toEqual({ attempted: 0, delivered: 0, skipped: 1 })
    expect(logs.join('\n')).toMatch(/бронь не прочиталась/)
  })

  it('вид не из списка напоминаний — не шлём: событие брони шлёт notify-rental', async () => {
    const { deps, sent } = makeDeps({ owner: [sub('o', 'fr')] })
    const report = await pushReminders(deps, [{ user_id: 'owner', kind: 'new_request', booking_id: 'b-1' }], BOOKINGS)
    expect(sent).toHaveLength(0)
    expect(report.skipped).toBe(1)
  })

  it('сбой службы не выходит наружу', async () => {
    const { deps } = makeDeps({ owner: [sub('o', 'fr')] })
    const failing: PushDeps = { ...deps, send: vi.fn(async () => { throw new Error('boom') }) }
    await expect(pushReminders(failing, [{ user_id: 'owner', kind: 'request_reminder', booking_id: 'b-1' }], BOOKINGS))
      .resolves.toEqual({ attempted: 1, delivered: 0, skipped: 0 })
  })
})

describe('напоминания вписаны в общую таблицу уведомлений', () => {
  it('каждый вид напоминания — среди видов push, с доставкой', () => {
    for (const kind of REMINDER_KINDS) {
      expect(PUSH_KINDS).toContain(kind)
      expect(DELIVERY[kind].ttl).toBeGreaterThan(0)
    }
  })

  it('напоминание о заявке не живёт дольше самой заявки', () => {
    // Окно напоминания открывается через 18 ч, заявка сгорает в 24 ч.
    expect(DELIVERY.request_reminder.ttl).toBeLessThanOrEqual(6 * 3600)
  })

  it('факты: имена сторон не перепутаны', () => {
    const facts = reminderFacts(BOOKING)
    expect(renderPush('request_reminder', 'fr', facts).body).toContain('Rachel L.')
    expect(renderPush('return_tomorrow', 'fr', facts).body).toContain('Ramzan B.')
    expect(renderPush('return_unconfirmed', 'fr', facts).body).toContain('Rachel L.')
  })
})
