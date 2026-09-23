import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MAX_REPORTS_PER_PAGE, reportError, resetReportsForTests, type ReportDeps } from '../errorReport'
import type { LoggedError } from '../errorLog'

/**
 * Отправка отчёта о поломке: что уходит, сколько раз и когда молчит.
 * Сама отправка подменена — настоящий приём проверен прогоном функций
 * (npm run test:edge) и замером в браузере.
 */

const entry = (message = "TypeError: Cannot read properties of undefined (reading 'x')"): LoggedError => ({
  at: '2026-09-23T10:00:00.000Z',
  source: 'render',
  message,
  stack: 'TypeError: x\n    at Kt (https://rentit/assets/ItemDetail-abc123.js:1:2)',
  path: '/item/42',
})

const deps = (over: Partial<ReportDeps> = {}): ReportDeps & { send: ReturnType<typeof vi.fn> } => ({
  enabled: true,
  endpoint: 'https://project.supabase.co/functions/v1/report-error',
  anonKey: 'anon-key',
  release: 'a1b2c3d',
  lang: () => 'nl-BE',
  userAgent: () => 'Mozilla/5.0 Test',
  send: vi.fn(async () => ({ ok: true })),
  ...over,
}) as ReportDeps & { send: ReturnType<typeof vi.fn> }

beforeEach(() => resetReportsForTests())

describe('reportError', () => {
  it('уходит вид, текст, след, путь, версия, язык и браузер — и больше ничего', () => {
    const d = deps()
    reportError(entry(), d)
    expect(d.send).toHaveBeenCalledTimes(1)
    const [url, init] = d.send.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://project.supabase.co/functions/v1/report-error')
    expect(init.method).toBe('POST')
    // Переживает уход со страницы: отчёт о поломке часто последний запрос.
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({
      kind: 'render',
      message: "TypeError: Cannot read properties of undefined (reading 'x')",
      stack: 'TypeError: x\n    at Kt (https://rentit/assets/ItemDetail-abc123.js:1:2)',
      path: '/item/42',
      release: 'a1b2c3d',
      lang: 'nl',
      userAgent: 'Mozilla/5.0 Test',
    })
  })

  it('одна поломка — один отчёт за загрузку страницы', () => {
    const d = deps()
    for (let i = 0; i < 50; i++) reportError(entry(), d)
    expect(d.send).toHaveBeenCalledTimes(1)
  })

  it('поломка в цикле не заваливает сервер: не больше десяти за страницу', () => {
    const d = deps()
    for (let i = 0; i < 100; i++) reportError(entry(`Error: поломка №${i}`), d)
    expect(d.send).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE)
  })

  it('в разработке и в тестах — молчит', () => {
    const d = deps({ enabled: false })
    reportError(entry(), d)
    expect(d.send).not.toHaveBeenCalled()
  })

  it('незнакомый язык не уходит', () => {
    const d = deps({ lang: () => 'de' })
    reportError(entry(), d)
    expect(JSON.parse((d.send.mock.calls[0] as [string, RequestInit])[1].body as string).lang).toBeNull()
  })

  it('своя неудача отправки не становится новой поломкой', async () => {
    const rejecting = deps({ send: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    expect(() => reportError(entry(), rejecting)).not.toThrow()
    const throwing = deps({ send: vi.fn(() => { throw new Error('sync') }) })
    resetReportsForTests()
    expect(() => reportError(entry(), throwing)).not.toThrow()
    // Отклонённое обещание поймано: иначе оно ушло бы в unhandledrejection,
    // а оттуда — снова в журнал и снова сюда.
    await new Promise((r) => setTimeout(r, 0))
  })
})
