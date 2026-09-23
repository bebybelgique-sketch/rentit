import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Браузерная часть: память об отказах, ключ канала, выход из учётки.
 * Настоящую подписку в jsdom не сделать — она замерена в Chrome и Edge.
 */

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }))

import {
  fetchPublicKey, forgetPublicKeyForTests, notifyMessageSent, pushLangOf,
  readOfferMemory, releaseThisDevice, writeOfferMemory,
} from '../push'
import { EMPTY_MEMORY } from '../../domain/pushOffer'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  forgetPublicKeyForTests()
})

describe('память об отказах', () => {
  it('пишется и читается под именами из пакета Design', () => {
    writeOfferMemory({ dismissedCount: 2, dismissedAt: 1234, optedOut: true, blockedBannerDismissed: true })
    expect(localStorage.getItem('push_dismissed_count')).toBe('2')
    expect(localStorage.getItem('push_dismissed_at')).toBe('1234')
    expect(readOfferMemory()).toEqual({ dismissedCount: 2, dismissedAt: 1234, optedOut: true, blockedBannerDismissed: true })
  })

  it('мусор в хранилище читается как «ничего не было»', () => {
    localStorage.setItem('push_dismissed_count', 'abc')
    localStorage.setItem('push_dismissed_at', '-5')
    expect(readOfferMemory()).toEqual(EMPTY_MEMORY)
  })

  it('хранилище бросает (приватный режим) — не падаем', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(readOfferMemory()).toEqual(EMPTY_MEMORY)
    spy.mockRestore()
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => writeOfferMemory(EMPTY_MEMORY)).not.toThrow()
    set.mockRestore()
  })
})

describe('ключ канала', () => {
  it('503 push_not_configured — состояние, запоминается на сеанс', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        name: 'FunctionsHttpError',
        context: new Response(JSON.stringify({ error: 'push_not_configured' }), { status: 503 }),
      }),
    })
    await expect(fetchPublicKey()).resolves.toBeNull()
    await expect(fetchPublicKey()).resolves.toBeNull()
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })

  it('сбой сети — не запоминается, следующий вызов спросит снова', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error('offline'), { name: 'FunctionsFetchError' }) })
    await expect(fetchPublicKey()).rejects.toThrow()
    mocks.invoke.mockResolvedValueOnce({ data: { publicKey: 'BKEY' }, error: null })
    await expect(fetchPublicKey()).resolves.toBe('BKEY')
  })
})

describe('прочее', () => {
  it('язык уведомлений — из языка приложения, запасной французский', () => {
    expect(pushLangOf('nl')).toBe('nl')
    expect(pushLangOf('en-GB')).toBe('en')
    expect(pushLangOf('de')).toBe('fr')
    expect(pushLangOf(undefined)).toBe('fr')
  })

  it('уведомление о сообщении не роняет отправку', async () => {
    mocks.invoke.mockRejectedValue(new Error('сеть'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => notifyMessageSent('m1')).not.toThrow()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(mocks.invoke).toHaveBeenCalledWith('notify-message', { body: { message_id: 'm1' } })
    warn.mockRestore()
  })

  it('выход без воркера не бросает и не зовёт сервер', async () => {
    await expect(releaseThisDevice()).resolves.toBeUndefined()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
})
