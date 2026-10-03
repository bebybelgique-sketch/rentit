import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthRetryableFetchError, AuthApiError } from '@supabase/supabase-js';

// Сеть не дала проверить сессию — это не «вышел». До 03.10 getSession() с
// сетевой ошибкой читался как отсутствие сессии, и закрытые страницы
// уводили на вход человека, который ни из чего не выходил.

type Listener = (event: string, session: unknown) => void;

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  listener: null as Listener | null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: auth.getSession,
      onAuthStateChange: (cb: Listener) => {
        auth.listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));

import { AuthProvider, useAuth } from '../AuthContext';

const Probe = () => {
  const { user, loading, sessionUnknown } = useAuth();
  return <p>{loading ? 'loading' : sessionUnknown ? 'unknown' : user ? `user:${user.id}` : 'guest'}</p>;
};

const renderProvider = () => render(<AuthProvider><Probe /></AuthProvider>);
const session = (id: string) => ({ access_token: `at-${id}`, user: { id } });

describe('AuthContext: вошёл, вышел или неизвестно', () => {
  beforeEach(() => {
    auth.getSession.mockReset();
    auth.listener = null;
  });

  it('сессия есть — человек вошёл', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session('u-1') }, error: null });
    renderProvider();
    expect(await screen.findByText('user:u-1')).toBeInTheDocument();
  });

  it('сессии нет — гость', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderProvider();
    expect(await screen.findByText('guest')).toBeInTheDocument();
  });

  it('сеть не дала обновить токен — неизвестно, а не «вышел»', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    renderProvider();
    expect(await screen.findByText('unknown')).toBeInTheDocument();
    // auth-js при этом шлёт INITIAL_SESSION с пустой сессией — это не выход.
    act(() => auth.listener?.('INITIAL_SESSION', null));
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('сеть вернулась — спрашиваем снова, и человек снова вошёл', async () => {
    auth.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })
      .mockResolvedValueOnce({ data: { session: session('u-1') }, error: null });
    renderProvider();
    await screen.findByText('unknown');
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(await screen.findByText('user:u-1')).toBeInTheDocument();
  });

  it('токен обновился сам (TOKEN_REFRESHED) — человек вошёл', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    renderProvider();
    await screen.findByText('unknown');
    act(() => auth.listener?.('TOKEN_REFRESHED', session('u-1')));
    expect(screen.getByText('user:u-1')).toBeInTheDocument();
  });

  // Отозванный или просроченный refresh-токен — настоящий выход: auth-js
  // сам стирает сессию, и делать вид, что «неизвестно», нельзя.
  it('сервер отверг сессию — гость, а не «неизвестно»', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') });
    renderProvider();
    expect(await screen.findByText('guest')).toBeInTheDocument();
  });

  it('вышел (SIGNED_OUT) — гость', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session('u-1') }, error: null });
    renderProvider();
    await screen.findByText('user:u-1');
    act(() => auth.listener?.('SIGNED_OUT', null));
    await waitFor(() => expect(screen.getByText('guest')).toBeInTheDocument());
  });
});
