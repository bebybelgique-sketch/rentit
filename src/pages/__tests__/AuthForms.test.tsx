import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from '../Register'
import Login from '../Login'
import { supabase } from '../../lib/supabase'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams()],
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}))

describe('Auth forms hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigateMock.mockReset()
  })

  it('redirects new signups to login and tells them to verify email', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    } as any)

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/Full name|Nom complet/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText(/Password|Mot de passe|Wachtwoord/i), { target: { value: 'supersecret' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account|Créer un compte|Maak account/i }))

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled()
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
    })

    expect(screen.getByText(/check your inbox|vérifiez|controleer|Controleer/i)).toBeInTheDocument()
  })

  it('shows a friendly message when email confirmation is required to log in', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed' },
    } as any)

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText(/Password|Mot de passe|Wachtwoord/i), { target: { value: 'supersecret' } })
    fireEvent.click(screen.getByRole('button', { name: /Log in|Se connecter|Inloggen/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your inbox|confirm your email|vérifiez|controleer|bevestig/i)).toBeInTheDocument()
    })
  })
})
