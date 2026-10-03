import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Закрытая страница без сети: сессию не проверить (src/context/AuthContext.tsx,
 * sessionUnknown). До 03.10 это читалось как «вышел», и человека уводило на
 * вход посреди передачи инструмента — в подвале или гараже, где сети нет.
 */

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

const auth = vi.hoisted(() => ({ sessionUnknown: false }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, accessToken: null, loading: false, sessionUnknown: auth.sessionUnknown }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import App from '../App'

const mount = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

describe('закрытая страница, когда сессию не проверить', () => {
  beforeEach(() => { auth.sessionUnknown = false })

  it('сеть не дала проверить — объяснение, а не страница входа', async () => {
    auth.sessionUnknown = true
    mount('/my-items')
    expect(await screen.findByRole('status')).toHaveTextContent('Pas de connexion')
    expect(screen.queryByLabelText(/mot de passe/i)).not.toBeInTheDocument()
    // И навбар не зовёт «войти» того, кто, скорее всего, уже вошёл.
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument()
  })

  it('гость без сессии — по-прежнему на вход', async () => {
    mount('/my-items')
    expect(await screen.findByLabelText(/mot de passe/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Se connecter' }).length).toBeGreaterThan(0)
  })
})
