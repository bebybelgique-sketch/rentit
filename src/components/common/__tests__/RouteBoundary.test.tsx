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
afterEach(() => {
  restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const CHUNK = () => new TypeError('Failed to fetch dynamically imported module: /assets/Login-B7v.js')

const renderWith = (error: Error) =>
  render(
    <RouteBoundary message="La page n'a pas pu s'afficher." retry="Réessayer" offlineMessage="Pas disponible hors connexion.">
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

  // ГЛАВНОЕ (02.10). Флаг хранит время, и снять его «по дороге» больше
  // некому: до этого оболочка снимала его при монтировании, и без сети
  // перезагрузка шла по кругу без конца.
  it('перезагрузка минуту назад — второй раз не перезагружаемся', () => {
    sessionStorage.setItem('rentit_chunk_reload', String(Date.now() - 5_000))
    renderWith(CHUNK())
    expect(reload).not.toHaveBeenCalled()
  })

  // Следующий выкат в той же вкладке — снова законная попытка.
  it('перезагрузка давно — новая попытка разрешена', () => {
    sessionStorage.setItem('rentit_chunk_reload', String(Date.now() - 10 * 60_000))
    renderWith(CHUNK())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // Без сети кусок, которого нет в кэше, не загрузит никакая перезагрузка.
  it('без сети — честный текст, без перезагрузки и без отчёта', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderWith(CHUNK())
    expect(reload).not.toHaveBeenCalled()
    expect(mocks.logError).not.toHaveBeenCalled()
    expect(screen.getByText('Pas disponible hors connexion.')).toBeInTheDocument()
  })

  // Запрещённое хранилище бросает. Последняя преграда перед белым экраном
  // не должна падать вместе с ним — и не должна перезагружать по кругу:
  // без памяти о прошлой перезагрузке сама она не перезагружает.
  it('хранилище запрещено — экран ошибки на месте, по кругу не перезагружает', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError') })
    renderWith(CHUNK())
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByText("La page n'a pas pu s'afficher.")).toBeInTheDocument()
  })
})
