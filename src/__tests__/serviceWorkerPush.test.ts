import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Push в воркере — ПОВЕДЕНИЕМ, а не текстом.
 *
 * Кэш воркера проверяется по исходнику (serviceWorker.test.ts): поднимать
 * Cache API в jsdom значило бы проверять макет. Обработчики push другие —
 * им нужны три вещи: `self.addEventListener`, `registration.showNotification`
 * и `clients`. Их легко подделать честно, и тогда исполняется НАСТОЯЩИЙ
 * шаблон — тот самый файл, что уходит в сборку.
 *
 * Живой показ в Chrome и Edge замерен отдельно (PR «Push: клиент»).
 */

const template = readFileSync(join(process.cwd(), 'src', 'sw.template.js'), 'utf8')
  .replace(/__VERSION__/g, 'test')
  .replace(/__PRECACHE__/g, '[]')

interface FakeWindow {
  url: string
  postMessage: (message: unknown) => void
  focus: () => unknown
}

function loadWorker(windows: FakeWindow[] = []) {
  const listeners: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn(async () => {})
  const openWindow = vi.fn(async () => null)
  const self = {
    location: { origin: 'https://rentit.test' },
    addEventListener: (type: string, fn: (event: unknown) => void) => { listeners[type] = fn },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow, claim: vi.fn() },
  }
  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', template)(self, {})

  const dispatch = async (type: string, event: Record<string, unknown>) => {
    let pending: Promise<unknown> = Promise.resolve()
    listeners[type]({ ...event, waitUntil: (p: Promise<unknown>) => { pending = p } })
    await pending
  }
  return { dispatch, showNotification, openWindow }
}

const pushEvent = (payload: unknown) => ({
  data: { json: () => (typeof payload === 'string' ? JSON.parse(payload) : payload) },
})

describe('push', () => {
  it('показывает ровно то, что прислал сервер, со слотом брони', async () => {
    const w = loadWorker()
    await w.dispatch('push', pushEvent({
      title: 'Demande pour « Perceuse »',
      body: 'Julien V. · 24 → 26 sept. · €45. Répondez sous 24 h.',
      tag: 'booking-abc',
      url: '/my-rentals?booking=abc',
      lang: 'fr',
    }))
    expect(w.showNotification).toHaveBeenCalledWith('Demande pour « Perceuse »', expect.objectContaining({
      body: 'Julien V. · 24 → 26 sept. · €45. Répondez sous 24 h.',
      tag: 'booking-abc',
      renotify: true,
      lang: 'fr',
      icon: '/icons/icon-192.png',
      data: { url: '/my-rentals?booking=abc' },
    }))
  })

  /**
   * Chrome требует видимое уведомление на КАЖДОЕ сообщение. Не показать —
   * значит получить его служебное «сайт обновился в фоне», а после
   * нескольких таких браузер вправе отозвать подписку.
   */
  it('нечитаемое тело всё равно даёт уведомление', async () => {
    const w = loadWorker()
    await w.dispatch('push', { data: { json: () => { throw new SyntaxError('не JSON') } } })
    expect(w.showNotification).toHaveBeenCalledWith('RentIt', expect.objectContaining({ body: '' }))
  })

  it('без tag нет и renotify — иначе браузер бросает исключение', async () => {
    const w = loadWorker()
    await w.dispatch('push', pushEvent({ title: 'x', body: 'y' }))
    expect(w.showNotification).toHaveBeenCalledWith('x', expect.objectContaining({ tag: undefined, renotify: false }))
  })

  it('чужой адрес перехода заменяется своим', async () => {
    for (const url of ['https://evil.example/', '//evil.example/x', 'javascript:alert(1)']) {
      const w = loadWorker()
      await w.dispatch('push', pushEvent({ title: 't', body: 'b', tag: 'booking-1', url }))
      expect(w.showNotification).toHaveBeenCalledWith('t', expect.objectContaining({ data: { url: '/my-rentals' } }))
    }
  })
})

describe('нажатие на уведомление', () => {
  const click = (url: unknown) => ({ notification: { close: vi.fn(), data: { url } } })

  it('открытая вкладка переходит сама, без перезагрузки', async () => {
    const tab: FakeWindow = { url: 'https://rentit.test/browse', postMessage: vi.fn(), focus: vi.fn(async () => {}) }
    const w = loadWorker([tab])
    const event = click('/my-rentals?booking=abc')
    await w.dispatch('notificationclick', event)
    expect(event.notification.close).toHaveBeenCalled()
    expect(tab.postMessage).toHaveBeenCalledWith({ type: 'rentit:navigate', url: '/my-rentals?booking=abc' })
    expect(tab.focus).toHaveBeenCalled()
    expect(w.openWindow).not.toHaveBeenCalled()
  })

  it('вкладки нет — открывается новая', async () => {
    const w = loadWorker([])
    await w.dispatch('notificationclick', click('/my-rentals?booking=abc'))
    expect(w.openWindow).toHaveBeenCalledWith('/my-rentals?booking=abc')
  })

  it('вкладка чужого сайта не используется', async () => {
    const other: FakeWindow = { url: 'https://other.test/', postMessage: vi.fn(), focus: vi.fn() }
    const w = loadWorker([other])
    await w.dispatch('notificationclick', click('/my-rentals'))
    expect(other.postMessage).not.toHaveBeenCalled()
    expect(w.openWindow).toHaveBeenCalledWith('/my-rentals')
  })

  it('адрес из уведомления проверяется и при нажатии', async () => {
    const w = loadWorker([])
    await w.dispatch('notificationclick', click('https://evil.example/'))
    expect(w.openWindow).toHaveBeenCalledWith('/my-rentals')
  })
})
