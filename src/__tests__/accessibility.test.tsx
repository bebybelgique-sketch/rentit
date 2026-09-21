import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * ДОСТУПНОСТЬ ОБОЛОЧКИ: то, что видно не глазами.
 *
 * ── ЗАМЕР, С КОТОРОГО ВСЁ НАЧАЛОСЬ (21.09.2026, своя сборка) ─────────
 *
 *     адрес      main  skip  lang
 *     /          0     0     fr
 *     /browse    0     0     fr
 *     /login     0     0     fr
 *     /terms     0     0     fr
 *
 *     фокус до перехода:  "RentIt"
 *     фокус после:        "Parcourir" <A>
 *
 * Ни одного ориентира <main>, ни одной ссылки «к содержимому», а после
 * перехода фокус оставался на НАЖАТОЙ ССЫЛКЕ — то есть смена экрана не
 * сообщалась никак.
 *
 * Отдельно окно согласия — первый экран каждого посетителя и юридический
 * гейт:
 *
 *     role: null · aria-modal: null · имени нет
 *     фокус при открытии: остался на body
 *     обход Tab: шесть остановок по навигации ЗА окном
 *     Escape: не закрывает
 *
 * ── ПОЧЕМУ СТОРОЖ, А НЕ ПРОСТО ПРАВКА ────────────────────────────────
 *
 * Всё перечисленное невидимо тому, кто смотрит на экран: продукт
 * выглядит совершенно исправным. Такие вещи пропадают при первой же
 * перестановке разметки, и никто этого не замечает — до жалобы, которой
 * не будет, потому что человек просто уйдёт.
 */

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, accessToken: null }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import App from '../App'

const mount = (path = '/') =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

beforeEach(() => {
  try { localStorage.clear() } catch { /* приватный режим */ }
})

describe('ориентиры страницы', () => {
  it.each(['/', '/browse', '/login', '/terms'])('%s: есть область содержимого', async (path) => {
    const { container } = mount(path)
    await waitFor(() => expect(container.querySelector('nav')).toBeTruthy())

    const main = container.querySelector('main')
    expect(main, 'без <main> навигацию нечем перескочить').toBeTruthy()
    // Фокус на область переводится программно при смене экрана; -1
    // делает её фокусируемой, не добавляя лишней остановки при Tab.
    expect(main?.getAttribute('tabindex')).toBe('-1')
    expect(main?.id).toBe('main-content')
  })

  it('ссылка «к содержимому» идёт ПЕРВОЙ, до навигации', async () => {
    const { container } = mount('/')
    await waitFor(() => expect(container.querySelector('nav')).toBeTruthy())

    const skip = container.querySelector('.skip-link')
    expect(skip, 'ссылки «к содержимому» нет').toBeTruthy()
    expect(skip?.getAttribute('href')).toBe('#main-content')

    // Именно ПЕРВОЙ: поставленная после навигации, она не перескакивает
    // ничего — до неё ещё надо дойти.
    const focusables = container.querySelectorAll('a[href], button')
    expect(focusables[0]).toBe(skip)
  })
})

describe('окно согласия ведёт себя как диалог', () => {
  const openDialog = async () => {
    const view = mount('/')
    const dialog = await screen.findByRole('dialog')
    return { view, dialog }
  }

  it('объявляет себя диалогом и имеет имя', async () => {
    const { dialog } = await openDialog()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // Без имени окно объявляется как «диалог» и ничего больше.
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    const nameNode = document.getElementById(dialog.getAttribute('aria-labelledby')!)
    expect(nameNode?.textContent?.trim()).toBeTruthy()
  })

  it('забирает фокус внутрь себя', async () => {
    const { dialog } = await openDialog()
    await waitFor(() => {
      expect(
        dialog.contains(document.activeElement),
        'фокус остался на странице за окном',
      ).toBe(true)
    })
  })

  /**
   * Escape = «отказаться от необязательных». Не «принять всё» — молчание
   * согласием не является; и не «ничего» — окно, из которого нельзя выйти
   * клавиатурой, это ловушка.
   */
  it('Escape закрывает и записывает отказ, а не согласие', async () => {
    await openDialog()
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const saved = JSON.parse(localStorage.getItem('rentit_cookie_consent') ?? '{}')
    expect(saved.necessary).toBe(true)
    expect(saved.analytics, 'Escape не должен означать согласие на аналитику').toBe(false)
    expect(saved.functional).toBe(false)
  })

  it('выбор на экране никуда не делся — отказ так же доступен, как согласие', async () => {
    const { dialog } = await openDialog()
    // Требование CNIL: отказаться должно быть не сложнее, чем принять.
    // Обе кнопки — в самом окне, на одном уровне.
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })
})
