import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MAX_PENDING, countUsage, resetUsageForTests, usageConsentDecided, type UsageDeps } from '../usage'

/**
 * Дневные счётчики: что уходит, когда молчат и что ждёт выбора в баннере.
 * Сама отправка подменена — приём на базе проверен живым тестом
 * supabase/tests/usage_counts.sql.
 */

const deps = (over: Partial<UsageDeps> = {}): UsageDeps & { send: ReturnType<typeof vi.fn> } => ({
  enabled: true,
  endpoint: 'https://project.supabase.co/rest/v1/rpc/count_usage',
  anonKey: 'anon-key',
  consent: () => true,
  isRobot: () => false,
  send: vi.fn(async () => ({ ok: true })),
  ...over,
}) as UsageDeps & { send: ReturnType<typeof vi.fn> }

const sentEvents = (d: { send: ReturnType<typeof vi.fn> }) =>
  d.send.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).p_event)

beforeEach(() => resetUsageForTests())

describe('countUsage', () => {
  it('с согласием уходит одно имя события — и больше ничего', () => {
    const d = deps()
    countUsage('home_view', d)
    expect(d.send).toHaveBeenCalledTimes(1)
    const [url, init] = d.send.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/count_usage')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({ p_event: 'home_view' })
  })

  // Вошедший человек не должен уехать в запросе своим токеном: ключ — общий anon.
  it('запрос несёт ключ anon, а не сессию человека', () => {
    const d = deps()
    countUsage('hero_search', d)
    const headers = (d.send.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer anon-key')
    expect(headers.apikey).toBe('anon-key')
  })

  it('отказавшийся не считается', () => {
    const d = deps({ consent: () => false })
    countUsage('home_view', d)
    usageConsentDecided(true, d)
    expect(d.send).not.toHaveBeenCalled()
  })

  // prod-smoke открывает главную прода после каждого слияния и согласие
  // ставит сам — без этой проверки каждое слияние было бы «визитом».
  it('робота не считают даже с согласием', () => {
    const d = deps({ isRobot: () => true })
    countUsage('home_view', d)
    expect(d.send).not.toHaveBeenCalled()
  })

  it('в разработке и в тестах молчит', () => {
    const d = deps({ enabled: false })
    countUsage('home_view', d)
    expect(d.send).not.toHaveBeenCalled()
  })

  it('своя неудача отправки не роняет страницу', () => {
    const d = deps({ send: vi.fn(() => { throw new Error('offline') }) })
    expect(() => countUsage('home_view', d)).not.toThrow()
  })
})

describe('до выбора в баннере', () => {
  // Главная открывается раньше, чем человек нажмёт кнопку баннера. Без
  // очереди первый заход каждого нового человека не считался бы никогда.
  it('событие ждёт и уходит, когда человек согласился', () => {
    const d = deps({ consent: () => null })
    countUsage('home_view', d)
    countUsage('hero_search', d)
    expect(d.send).not.toHaveBeenCalled()
    usageConsentDecided(true, d)
    expect(sentEvents(d)).toEqual(['home_view', 'hero_search'])
  })

  it('и выбрасывается, когда отказался', () => {
    const d = deps({ consent: () => null })
    countUsage('home_view', d)
    usageConsentDecided(false, d)
    usageConsentDecided(true, d)
    expect(d.send).not.toHaveBeenCalled()
  })

  it('очередь не растёт без предела', () => {
    const d = deps({ consent: () => null })
    for (let i = 0; i < MAX_PENDING + 15; i++) countUsage('browse_view', d)
    usageConsentDecided(true, d)
    expect(d.send).toHaveBeenCalledTimes(MAX_PENDING)
  })

  it('робот не копит очередь', () => {
    countUsage('home_view', deps({ consent: () => null, isRobot: () => true }))
    const human = deps()
    usageConsentDecided(true, human)
    expect(human.send).not.toHaveBeenCalled()
  })
})
