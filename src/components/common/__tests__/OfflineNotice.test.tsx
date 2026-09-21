import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import OfflineNotice from '../OfflineNotice'

/**
 * Полоса «нет сети».
 *
 * ЗАЧЕМ ОНА ВООБЩЕ. С воркером приложение без сети ОТКРЫВАЕТСЯ — и этим
 * создаёт новую ложь: экран выглядит рабочим, но заявка не уйдёт, а
 * список показывает то, что успело приехать раньше. Разница между
 * «сломалось» и «нет сети» — единственное, что человеку сейчас нужно
 * знать, и сказать это обязан продукт.
 */

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  setOnline(true)
  vi.restoreAllMocks()
})

describe('полоса «нет сети»', () => {
  it('при живой сети её нет вовсе', () => {
    setOnline(true)
    const { container } = render(<OfflineNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('появляется, если страница открыта уже без сети', () => {
    // Не только по событию: человек мог открыть приложение из кэша,
    // когда сети уже не было, и события `offline` тогда не будет.
    setOnline(false)
    render(<OfflineNotice />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('появляется, когда сеть пропала при открытой странице', () => {
    setOnline(true)
    render(<OfflineNotice />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('уходит сама, когда сеть вернулась', () => {
    setOnline(false)
    render(<OfflineNotice />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    // Тост исчез бы и сам; полоса обязана висеть РОВНО пока длится
    // причина — иначе человек гадает, всё ли ещё он офлайн.
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('говорит, что именно не будет работать, а не просто «офлайн»', () => {
    setOnline(false)
    render(<OfflineNotice />)
    // «Hors ligne» само по себе — констатация. Человеку нужно следствие:
    // изменения не сохранятся.
    expect(screen.getByRole('status').textContent).toMatch(/enregistr/i)
  })

  it('сообщает вежливо, а не перебивает', () => {
    setOnline(false)
    render(<OfflineNotice />)
    // `alert` прервал бы то, что человек слушает сейчас. Сообщение
    // важное, но не срочное.
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('снимает слушатели за собой', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<OfflineNotice />)
    unmount()
    const events = remove.mock.calls.map(([e]) => e)
    expect(events).toContain('offline')
    expect(events).toContain('online')
  })
})
