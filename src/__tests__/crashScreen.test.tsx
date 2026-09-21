import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * БЕЛОГО ЭКРАНА НЕ БЫВАЕТ.
 *
 * ── ЧТО БЫЛО УСТРОЕНО НЕ ТАК ─────────────────────────────────────────
 *
 * `RouteBoundary` обёрнут вокруг `<Routes>` и ловит падения СТРАНИЦ. А
 * навигация, нижняя панель, окно согласия и полоса «нет сети» стоят
 * СНАРУЖИ него. Падение в любом из них React обрабатывает единственным
 * доступным способом: снимает всё дерево. Человек получает пустую
 * страницу и ни одного слова.
 *
 * Это не гипотеза — это видно по тому, где в App.tsx стоит `<Navbar>`
 * относительно `<RouteBoundary>`.
 *
 * ── ПОЧЕМУ ПРОВЕРЯЕТСЯ ИМЕННО ПАДЕНИЕ В НАВИГАЦИИ ────────────────────
 *
 * Потому что падение на странице ловилось и раньше. Разницу делает
 * только то, что снаружи.
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

/**
 * Ломаем НИЖНЮЮ ПАНЕЛЬ — деталь навигации, стоящую вне RouteBoundary.
 * Выбрана она, а не навбар, потому что навбар рисует знак продукта, по
 * которому другие наборы отличают «дерево собралось»: сломав его, я бы
 * проверял заодно и их признак.
 */
vi.mock('../components/layout/BottomNav', () => ({
  default: () => { throw new Error('поломка в навигации') },
}))

import App from '../App'

// React печатает пойманную ошибку в консоль. Здесь это ожидаемо и не
// должно засорять вывод набора.
// Тип вычисляется из самого вызова: явная аннотация
// `ReturnType<typeof vi.spyOn>` теряет параметры обобщения и роняет
// tsc — а тесты тайпчекаются наравне с продуктом (шаг «Сборка» в CI).
let restoreConsole = () => {}
beforeEach(() => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  restoreConsole = () => spy.mockRestore()
})
afterEach(() => restoreConsole())

describe('экран поломки', () => {
  it('падение в навигации не даёт пустой страницы', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}><App /></MemoryRouter>,
    )
    expect(container).not.toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('на экране написано, что случилось и что делать', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    // Не «что-то пошло не так» — человек должен понять, что уйти можно.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBeTruthy()
    expect(screen.getByRole('button', { name: /accueil|home|start/i })).toBeInTheDocument()
  })

  /**
   * Единственный след поломки сегодня — строка в консоли, которую никто
   * никогда не откроет. Разговор начинается со слов «у меня не
   * работает». Кнопка превращает его в письмо с точным местом падения.
   */
  it('есть чем прислать подробности', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /copier|kopi|copy/i })).toBeInTheDocument()
  })

  /**
   * Экран поломки не имеет права опираться на то, что могло упасть.
   * Словарь сюда приходит пропсами, а оформление — своими стилями, без
   * классов продукта.
   */
  it('подписи переведены, а не оставлены ключами', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    const heading = screen.getByRole('heading', { level: 1 }).textContent ?? ''
    expect(heading).not.toContain('crash.')
    expect(heading.length).toBeGreaterThan(4)
  })
})
