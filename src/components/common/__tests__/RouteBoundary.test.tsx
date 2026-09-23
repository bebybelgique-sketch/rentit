import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Падение страницы попадает в журнал — а значит, и на сервер.
 *
 * До 23.09 RouteBoundary писал только в консоль: падения СТРАНИЦ — а их
 * большинство — не видел ни журнал «скопировать подробности», ни кто-либо
 * ещё. Исключение одно и намеренное: первый непогрузившийся чанк после
 * выката лечится перезагрузкой, и считать его поломкой — шум после
 * каждого деплоя.
 */

const mocks = vi.hoisted(() => ({ logError: vi.fn() }))
vi.mock('../../../lib/errorLog', () => ({ logError: mocks.logError }))

import RouteBoundary from '../RouteBoundary'

const Boom = ({ error }: { error: Error }) => { throw error }

const reload = vi.fn()
let restore = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const original = window.location
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
  restore = () => {
    spy.mockRestore()
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  }
})
afterEach(() => restore())

const renderWith = (error: Error) =>
  render(
    <RouteBoundary message="La page n'a pas pu s'afficher." retry="Réessayer">
      <Boom error={error} />
    </RouteBoundary>,
  )

describe('RouteBoundary', () => {
  it('обычное падение страницы — в журнал', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'title')")
    renderWith(error)
    expect(mocks.logError).toHaveBeenCalledWith('render', error)
    expect(screen.getByText("La page n'a pas pu s'afficher.")).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('первый непогрузившийся чанк — перезагрузка, без отчёта', () => {
    renderWith(new TypeError('Failed to fetch dynamically imported module: /assets/Login-B7v.js'))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(mocks.logError).not.toHaveBeenCalled()
  })

  it('чанк не грузится и после перезагрузки — это уже поломка, в журнал', () => {
    sessionStorage.setItem('rentit_chunk_reload', '1')
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/Login-B7v.js')
    renderWith(error)
    expect(reload).not.toHaveBeenCalled()
    expect(mocks.logError).toHaveBeenCalledWith('render', error)
  })
})
