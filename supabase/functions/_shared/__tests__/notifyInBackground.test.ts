import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notifyRentalInBackground } from '../notify'

// Действие человека с бронью не ждёт отправки уведомлений о нём.
//
// Замер 24.09 прогоном против прода, пока request-rental ждал
// notify-rental: медиана ответа на заявку 1430 мс, максимум 14 098 мс.
// Письма и push — дело второй стороны; ответ первой их ждать не должен.

const FUNCTIONS = join(process.cwd(), 'supabase', 'functions')

// Там, где ответа никто не ждёт, отправку дожидаются до конца: ночная
// задача не отвечает человеку, а завершиться раньше писем ей незачем.
const WAITS_ON_PURPOSE = new Set(['expire-bookings'])

const sourceOf = (dir: string) => {
  const file = join(FUNCTIONS, dir, 'index.ts')
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

describe('уведомления о бронях уходят в фоне — классом, а не одной функцией', () => {
  it('ни одна функция, отвечающая человеку, не ждёт notifyRental', () => {
    const blocking = readdirSync(FUNCTIONS)
      .filter((dir) => !dir.startsWith('_') && !WAITS_ON_PURPOSE.has(dir))
      .filter((dir) => /\bnotifyRental\s*\(/.test(sourceOf(dir) ?? ''))
    expect(blocking).toEqual([])
  })

  // Список исключений не должен пережить своё основание: функция, которая
  // перестала звать notifyRental, из него уходит.
  it('исключения действительно зовут notifyRental', () => {
    for (const dir of WAITS_ON_PURPOSE) {
      expect(sourceOf(dir), dir).toMatch(/\bnotifyRental\s*\(/)
    }
  })
})

describe('notifyRentalInBackground', () => {
  let releaseFetch: () => void
  const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
    releaseFetch = () => resolve(new Response('{}', { status: 200 }))
  }))

  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: (k: string) => ({ SUPABASE_URL: 'https://x.test', SUPABASE_SERVICE_ROLE_KEY: 'k' } as Record<string, string>)[k] } })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    fetchMock.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('в рантайме Supabase ответ не ждёт отправки, а отправка отдана waitUntil', async () => {
    const waitUntil = vi.fn()
    vi.stubGlobal('EdgeRuntime', { waitUntil })

    let settled = false
    const done = notifyRentalInBackground('b-1', 'pending_approval').then(() => { settled = true })
    await Promise.resolve()
    await done
    // Отправка ещё висит (fetch не отпущен), а вызов уже вернулся.
    expect(settled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(waitUntil).toHaveBeenCalledTimes(1)

    releaseFetch()
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined()
  })

  it('вне рантайма фона нет — отправка ждётся, как раньше', async () => {
    let settled = false
    const done = notifyRentalInBackground('b-1', 'approved').then(() => { settled = true })
    await new Promise((r) => setTimeout(r, 10))
    expect(settled).toBe(false)
    releaseFetch()
    await done
    expect(settled).toBe(true)
  })
})
