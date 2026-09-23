import { describe, it, expect, vi } from 'vitest'
import { pushToUser, pushForBookingEvent, notifyUser, supabaseDeps, type PushDeps, type StoredSubscription, type BookingForPush, type ActivityEntry } from '../push'
import type { PushOutcome } from '../webPush'

/**
 * Доставка: кому, на каком языке и что делать с ответом службы.
 * Всё проверяется без Supabase и без сети — зависимости подставлены.
 */

const VAPID = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:x@example.org' }
const BOOKING = '3f2c9a1b-8e7d-4c6f-a0b1-c2d3e4f5a6b7'

const sub = (endpoint: string, lang: string): StoredSubscription => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${endpoint}`, p256dh: 'k', auth: 'a', lang,
})

const makeDeps = (subsByUser: Record<string, StoredSubscription[]>, outcome: (s: StoredSubscription) => PushOutcome = () => ({ kind: 'sent', status: 201 })) => {
  const logs: string[] = []
  const removed: string[] = []
  const sent: Array<{ endpoint: string; payload: any; opts: any }> = []
  const deps: PushDeps = {
    vapid: VAPID,
    listSubscriptions: async (u) => subsByUser[u] ?? [],
    removeSubscription: async (e) => { removed.push(e) },
    send: vi.fn(async (target, payload, _v, opts) => {
      sent.push({ endpoint: target.endpoint, payload, opts })
      return outcome(target as StoredSubscription)
    }),
    log: (l) => logs.push(l),
  }
  return { deps, logs, removed, sent }
}

describe('доставка одному человеку', () => {
  it('ключей нет — не отправляем, говорим почему', async () => {
    const { deps, logs } = makeDeps({ u1: [sub('a', 'fr')] })
    const report = await pushToUser({ ...deps, vapid: null }, 'u1', 'accepted', {}, BOOKING)
    expect(report.skipped).toBe('not_configured')
    expect(deps.send).not.toHaveBeenCalled()
    expect(logs.join('\n')).toMatch(/VAPID/)
  })

  it('подписок нет — тишина, без ошибки', async () => {
    const { deps } = makeDeps({})
    expect((await pushToUser(deps, 'u1', 'accepted', {}, BOOKING)).skipped).toBe('no_subscriptions')
  })

  /**
   * Язык — УСТРОЙСТВА, а не человека: на телефоне он мог выбрать
   * нидерландский, на ноутбуке — французский. Каждое получает своё.
   */
  it('каждое устройство — на своём языке', async () => {
    const { deps, sent } = makeDeps({ u1: [sub('phone', 'nl'), sub('laptop', 'fr'), sub('old', 'de')] })
    await pushToUser(deps, 'u1', 'accepted', { ownerName: 'Ramzan Bekov', itemTitle: 'Perceuse' }, BOOKING)
    const by = Object.fromEntries(sent.map((s) => [s.endpoint.split('/').pop(), s.payload]))
    expect(by.phone.title).toBe('Ramzan B. heeft aanvaard')
    expect(by.laptop.title).toBe('Ramzan B. a accepté')
    // Незнакомый язык в базе — французский, основной язык продукта.
    expect(by.old.lang).toBe('fr')
  })

  it('одна бронь — одно место: тег, тема и ссылка по брони', async () => {
    const { deps, sent } = makeDeps({ u1: [sub('a', 'fr')] })
    await pushToUser(deps, 'u1', 'new_request', {}, BOOKING)
    expect(sent[0].payload.tag).toBe(`booking-${BOOKING}`)
    expect(sent[0].payload.url).toBe(`/my-rentals?booking=${BOOKING}`)
    expect(sent[0].opts.topic).toHaveLength(32)
    expect(sent[0].opts.urgency).toBe('high')
  })

  it('подписки больше нет — убираем её', async () => {
    const { deps, removed } = makeDeps(
      { u1: [sub('dead', 'fr'), sub('alive', 'fr')] },
      (s) => (s.endpoint.endsWith('dead') ? { kind: 'gone', status: 410 } : { kind: 'sent', status: 201 }),
    )
    const report = await pushToUser(deps, 'u1', 'accepted', {}, BOOKING)
    expect(report).toEqual({ sent: 1, gone: 1, failed: 0 })
    expect(removed).toEqual(['https://fcm.googleapis.com/fcm/send/dead'])
  })

  it('служба отказала временно — подписка остаётся', async () => {
    const { deps, removed } = makeDeps({ u1: [sub('a', 'fr')] }, () => ({ kind: 'rejected', status: 429, detail: 'slow' }))
    const report = await pushToUser(deps, 'u1', 'accepted', {}, BOOKING)
    expect(report.failed).toBe(1)
    expect(removed).toEqual([])
  })

  it('падение отправки не выходит наружу', async () => {
    const { deps } = makeDeps({ u1: [sub('a', 'fr')] })
    const boom = { ...deps, send: async () => { throw new Error('boom') } }
    await expect(pushToUser(boom, 'u1', 'accepted', {}, BOOKING)).resolves.toMatchObject({ failed: 1 })
  })

  it('база не ответила — не бросаем', async () => {
    const { deps } = makeDeps({})
    const broken = { ...deps, listSubscriptions: async () => { throw new Error('db down') } }
    await expect(pushToUser(broken, 'u1', 'accepted', {}, BOOKING)).resolves.toMatchObject({ skipped: 'error' })
  })

  /**
   * Лог читают не те, кому писали. Адрес подписки — это ключ, по которому
   * человеку можно слать сообщения; текст переписки — чужой разговор.
   * Ни того, ни другого в логе быть не должно, как бы ни прошла отправка.
   */
  it('в лог не попадает ни адрес подписки, ни текст переписки', async () => {
    for (const outcome of [
      { kind: 'sent', status: 201 },
      { kind: 'gone', status: 410 },
      { kind: 'rejected', status: 400, detail: 'bad' },
      { kind: 'network', detail: 'reset' },
    ] as PushOutcome[]) {
      const { deps, logs } = makeDeps({ u1: [sub('SECRET-ENDPOINT', 'fr')] }, () => outcome)
      await pushToUser(deps, 'u1', 'new_message', { otherName: 'Ana', messageBody: 'code du cadenas 4471' }, BOOKING)
      const all = logs.join('\n')
      expect(all, outcome.kind).not.toContain('SECRET-ENDPOINT')
      expect(all, outcome.kind).not.toContain('cadenas')
    }
  })
})

describe('события брони → получатели (таблица пакета)', () => {
  const b: BookingForPush = {
    id: BOOKING, renter_id: 'renter', ownerId: 'owner',
    start_date: '2026-09-20', end_date: '2026-09-21', total_price: 36,
    itemTitle: 'Perceuse', ownerName: 'Ramzan Bekov', renterName: 'Julien Vermeulen',
  }
  const everyone = { renter: [sub('r', 'fr')], owner: [sub('o', 'fr')] }

  const run = async (event: string) => {
    const { deps, sent } = makeDeps(everyone)
    await pushForBookingEvent(deps, event, b)
    return sent.map((s) => `${s.endpoint.split('/').pop()}:${s.payload.title}`).sort()
  }

  it('заявка → владельцу', async () => {
    expect(await run('pending_approval')).toEqual(['o:Demande pour « Perceuse »'])
  })

  it('принята → арендатору', async () => {
    expect(await run('approved')).toEqual(['r:Ramzan B. a accepté'])
  })

  it('отклонена → арендатору', async () => {
    expect(await run('rejected')).toEqual(['r:Ramzan B. a refusé'])
  })

  it('истекла → обоим, каждому свой текст', async () => {
    expect(await run('expired')).toEqual(['o:Demande expirée', 'r:Pas de réponse de Ramzan B.'])
  })

  it.each(['cancelled', 'active', 'completed', 'confirmed', 'payment_expired', 'нечто'])(
    '%s — уведомлений нет', async (event) => {
      expect(await run(event)).toEqual([])
    },
  )
})

// ── Лента (миграция 42) ─────────────────────────────────────────────

describe('лента: одно событие — одна запись, push рядом', () => {
  const b: BookingForPush = {
    id: BOOKING, renter_id: 'renter', ownerId: 'owner',
    start_date: '2026-09-20', end_date: '2026-09-21', total_price: 36,
    itemTitle: 'Perceuse', ownerName: 'Ramzan Bekov', renterName: 'Julien Vermeulen',
  }

  const withFeed = (over: Partial<PushDeps> = {}) => {
    const recorded: ActivityEntry[] = []
    const base = makeDeps({ renter: [sub('r', 'fr')], owner: [sub('o', 'fr')] })
    const deps: PushDeps = {
      ...base.deps,
      recordActivity: async (e) => { recorded.push(e) },
      ...over,
    }
    return { deps, recorded, sent: base.sent }
  }

  const feed = async (event: string, booking: BookingForPush = b) => {
    const { deps, recorded } = withFeed()
    await pushForBookingEvent(deps, event, booking)
    return recorded.map((r) => `${r.userId}:${r.kind}`).sort()
  }

  it('события пакета пишутся тем же, кому уходит push', async () => {
    expect(await feed('pending_approval')).toEqual(['owner:new_request'])
    expect(await feed('approved')).toEqual(['renter:accepted'])
    expect(await feed('rejected')).toEqual(['renter:declined'])
    expect(await feed('expired')).toEqual(['owner:expired_owner', 'renter:expired_renter'])
  })

  /**
   * Смысл ленты: она не зависит от push. Без ключей, без подписок, у
   * отказавшихся от уведомлений — запись есть всё равно.
   */
  it('без ключей и без подписок запись всё равно есть', async () => {
    const { deps, recorded } = withFeed({ vapid: null, listSubscriptions: async () => [] })
    const report = await notifyUser(deps, 'owner', 'new_request', {}, BOOKING)
    expect(recorded).toEqual([{ userId: 'owner', kind: 'new_request', bookingId: BOOKING, messageId: null }])
    expect(report.skipped).toBe('not_configured')
  })

  it('отмена — второй стороне, с именем отменившего, и БЕЗ push', async () => {
    const byRenter = withFeed()
    await pushForBookingEvent(byRenter.deps, 'cancelled', { ...b, cancelledBy: 'renter' })
    expect(byRenter.recorded.map((r) => `${r.userId}:${r.kind}`)).toEqual(['owner:cancelled'])
    expect(byRenter.sent).toEqual([])

    const byOwner = withFeed()
    await pushForBookingEvent(byOwner.deps, 'cancelled', { ...b, cancelledBy: 'owner' })
    expect(byOwner.recorded.map((r) => `${r.userId}:${r.kind}`)).toEqual(['renter:cancelled'])
    expect(byOwner.sent).toEqual([])
  })

  it('кто отменил, неизвестно — узнают обе стороны', async () => {
    expect(await feed('cancelled', { ...b, cancelledBy: null })).toEqual(['owner:cancelled', 'renter:cancelled'])
  })

  it('выдача и возврат в ленту не идут: их видят своими глазами', async () => {
    for (const event of ['active', 'completed', 'confirmed', 'payment_expired']) {
      expect(await feed(event)).toEqual([])
    }
  })

  it('неудача записи не отменяет push и не бросает', async () => {
    const { deps, sent } = withFeed({ recordActivity: async () => { throw new Error('база легла') } })
    await expect(notifyUser(deps, 'owner', 'new_request', {}, BOOKING)).resolves.toMatchObject({ sent: 1 })
    expect(sent).toHaveLength(1)
  })
})

describe('supabaseDeps.recordActivity', () => {
  const fakeSupabase = (insertError: { code: string; message: string } | null) => {
    const calls: string[] = []
    const client = {
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          calls.push(`insert ${table} ${row.kind}`)
          return { error: insertError }
        },
        delete: () => ({
          eq: (col: string, val: string) => ({
            lt: async (col2: string) => { calls.push(`delete ${table} ${col}=${val} ${col2}<cutoff`); return { error: null } },
          }),
        }),
      }),
    }
    return { client, calls }
  }

  it('пишет строку и подчищает у того же человека старше 90 дней', async () => {
    const { client, calls } = fakeSupabase(null)
    await supabaseDeps(client, VAPID).recordActivity!({ userId: 'u1', kind: 'accepted', bookingId: BOOKING, messageId: null })
    expect(calls).toEqual(['insert notifications accepted', 'delete notifications user_id=u1 created_at<cutoff'])
  })

  it('повтор события (23505) — не ошибка', async () => {
    const { client } = fakeSupabase({ code: '23505', message: 'duplicate key' })
    await expect(supabaseDeps(client, VAPID).recordActivity!({ userId: 'u1', kind: 'accepted', bookingId: BOOKING, messageId: null })).resolves.toBeUndefined()
  })

  it('настоящий отказ базы — ошибка (её ловит notifyUser)', async () => {
    const { client } = fakeSupabase({ code: '42501', message: 'permission denied' })
    await expect(supabaseDeps(client, VAPID).recordActivity!({ userId: 'u1', kind: 'accepted', bookingId: BOOKING, messageId: null })).rejects.toThrow(/permission denied/)
  })
})
