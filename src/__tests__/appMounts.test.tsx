import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * ПРИЛОЖЕНИЕ ВООБЩЕ ЗАПУСКАЕТСЯ.
 *
 * ── ЗАЧЕМ ТАКОЙ ТЕСТ ─────────────────────────────────────────────────
 *
 * 21.09.2026 счёт дел (useOwnerTasks → useQuery) был поставлен в тело
 * `App`, а `QueryClientProvider` возвращается ИЗ ЭТОГО ЖЕ компонента.
 * Клиент оказался потомком вызывающего хука: useQuery бросил при первом
 * рендере, и приложение не смонтировалось НИ НА ОДНОМ адресе — белая
 * страница везде.
 *
 * В тот момент набор состоял из 556 тестов, и все были зелёные. Ни один
 * не рендерил `App` целиком: проверяли домен, хуки, отдельные экраны,
 * значок, словари — всё, кроме того, поднимается ли продукт.
 *
 * Поймал это прогон по живой сборке, снимком пустой страницы. Такая
 * проверка стоит минуты и нужна не каждому изменению; эта — стоит
 * секунды и нужна каждому.
 *
 * ── ЧТО ИМЕННО СТЕРЕЖЁТСЯ ────────────────────────────────────────────
 *
 * Не разметка и не содержимое экранов — их проверяют свои наборы. Здесь
 * один вопрос: дерево провайдеров собрано так, что хуки под ними находят
 * свой контекст. Этот класс ошибок не виден ни типам (типы довольны), ни
 * сборке (она проходит), ни прогону экранов по отдельности.
 */

// Клиент Supabase бросает при загрузке без .env, а юнит-прогон его
// намеренно не видит (envDir в vitest.config.ts). Сеть здесь и не нужна:
// вопрос в устройстве дерева, а не в данных.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

let currentUser: { id: string } | null = null

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, accessToken: null }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import App from '../App'

const mount = (path = '/') =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

/**
 * Признак того, что дерево собралось: навбар нарисовал знак продукта.
 *
 * Проверяем по СВОЕМУ контейнеру, а не через screen: screen смотрит на
 * весь document.body, и знак из соседнего рендера дал бы ложный плюс —
 * тест был бы зелёным даже при полностью пустом собственном дереве.
 */
const mounted = (container: HTMLElement) =>
  Boolean(container.querySelector('.navbar-logo'))

describe('приложение монтируется', () => {
  beforeEach(() => { currentUser = null })

  it('гостю — на входе', async () => {
    const { container } = mount('/')
    await screen.findAllByRole('navigation')
    expect(mounted(container), 'дерево не собралось — навбар не нарисован').toBe(true)
  })

  it('вошедшему — там, где считаются дела', async () => {
    // Ровно тот случай, который и падал: у вошедшего работает
    // useOwnerTasks, а у гостя запрос выключен (enabled: !!userId) и
    // отсутствие клиента могло бы остаться незамеченным.
    currentUser = { id: 'u-1' }
    const { container } = mount('/my-items')
    await screen.findAllByRole('navigation')
    expect(mounted(container), 'дерево не собралось у вошедшего').toBe(true)
  })

  it('на несуществующем адресе', async () => {
    const { container } = mount('/takogo-adresa-net')
    await screen.findAllByRole('navigation')
    expect(mounted(container), 'дерево не собралось на перехвате 404').toBe(true)
  })
})
