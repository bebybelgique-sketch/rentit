import { describe, it, expect, vi } from 'vitest'
import { pushToUser, pushForBookingEvent, type PushDeps, type StoredSubscription, type BookingForPush } from '../push'
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
