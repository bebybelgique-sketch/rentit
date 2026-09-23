import { describe, it, expect } from 'vitest'
import { dayGroupOf, factsOf, groupByDay, toEntry, type ActivityRow } from '../activity'

/**
 * Лента: из строки базы — в текст на языке читателя. Тексты те же, что у
 * push (pushCopy.ts), поэтому здесь проверяется не фраза целиком, а то,
 * что в неё подставлено ПРАВИЛЬНОЕ имя: кто ответил, кто отменил, кто
 * написал. Перепутанное имя — худший дефект ленты: она сообщает неправду.
 */

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: 'n1',
  kind: 'new_request',
  booking_id: 'b-1',
  message_id: null,
  created_at: '2026-09-23T16:30:00+00:00',
  read_at: null,
  booking: {
    start_date: '2026-09-26',
    end_date: '2026-09-27',
    total_price: 30,
    renter_id: 'renter',
    cancelled_by: null,
    item: { title: 'Perceuse', owner: { full_name: 'Ramzan Bekov' } },
    renter: { full_name: 'Rachel Locataire' },
  },
  message: null,
  ...over,
})

describe('кто назван в строке', () => {
  it('заявка — владельцу, с именем арендатора', () => {
    expect(toEntry(row(), 'fr')).toMatchObject({
      title: 'Demande pour « Perceuse »',
      body: 'Rachel L. · 26 → 27 sept. · €30. Répondez sous 24 h.',
    })
  })

  it('ответ — арендатору, с именем владельца', () => {
    expect(toEntry(row({ kind: 'accepted' }), 'fr').title).toBe('Ramzan B. a accepté')
    expect(toEntry(row({ kind: 'declined' }), 'nl').title).toBe('Ramzan B. heeft geweigerd')
  })

  it('сообщение — с именем отправителя и превью без номера', () => {
    const e = toEntry(row({
      kind: 'new_message',
      message_id: 'm1',
      message: { body: 'Appelez-moi au 0475 12 34 56', sender: { full_name: 'Rachel Locataire' } },
    }), 'fr')
    expect(e.title).toBe('Rachel L. · nouveau message')
    expect(e.body).toBe('Appelez-moi au •••')
  })

  it('отмена — с именем ОТМЕНИВШЕГО, кто бы это ни был', () => {
    const byRenter = row({ kind: 'cancelled', booking: { ...row().booking!, cancelled_by: 'renter' } })
    expect(toEntry(byRenter, 'fr').title).toBe('Rachel L. a annulé')
    const byOwner = row({ kind: 'cancelled', booking: { ...row().booking!, cancelled_by: 'owner-id' } })
    expect(toEntry(byOwner, 'en').title).toBe('Ramzan B. cancelled')
    const unknown = row({ kind: 'cancelled' })
    expect(toEntry(unknown, 'fr').title).toBe('Un voisin a annulé')
  })

  it('бронь недоступна (удалённая учётка) — запасные слова, не пустота', () => {
    const e = toEntry(row({ kind: 'accepted', booking: null }), 'fr')
    expect(e.title).toBe('Votre voisin a accepté')
    expect(factsOf(row({ booking: null })).itemTitle).toBeNull()
  })

  it('ссылка ведёт на бронь — туда же, куда push', () => {
    expect(toEntry(row(), 'fr').href).toBe('/my-rentals?booking=b-1')
  })

  it('непрочитанное — по read_at', () => {
    expect(toEntry(row(), 'fr').unread).toBe(true)
    expect(toEntry(row({ read_at: '2026-09-23T17:00:00+00:00' }), 'fr').unread).toBe(false)
  })
})

describe('группы по дням — по МЕСТНОМУ дню (Брюссель)', () => {
  // 23.09 00:30 по Брюсселю = 22.09 22:30 UTC.
  const now = new Date('2026-09-23T00:30:00+02:00')

  it('сегодня, вчера, раньше', () => {
    expect(dayGroupOf('2026-09-23T00:10:00+02:00', now)).toBe('today')
    // 22.09 23:50 по Брюсселю — вчера, хотя по UTC это тоже 22-е.
    expect(dayGroupOf('2026-09-22T23:50:00+02:00', now)).toBe('yesterday')
    expect(dayGroupOf('2026-09-21T12:00:00+02:00', now)).toBe('earlier')
  })

  it('пустых групп нет, свежие сверху', () => {
    const entries = [
      toEntry(row({ id: 'old', created_at: '2026-09-20T10:00:00+00:00' }), 'fr'),
      toEntry(row({ id: 'a', created_at: '2026-09-22T22:20:00+00:00' }), 'fr'),
      toEntry(row({ id: 'b', created_at: '2026-09-22T22:25:00+00:00' }), 'fr'),
    ]
    const groups = groupByDay(entries, now)
    expect(groups.map((g) => g.group)).toEqual(['today', 'earlier'])
    expect(groups[0].entries.map((e) => e.id)).toEqual(['b', 'a'])
  })
})
