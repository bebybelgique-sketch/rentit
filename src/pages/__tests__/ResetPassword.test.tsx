import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Страница нового пароля. До 02.10 она ждала одного события
// PASSWORD_RECOVERY и висела «Vérification du lien…» вечно, если ссылка
// была с ошибкой (события нет вовсе) или событие ушло раньше подписки
// (страница грузится лениво). Теперь решение — по тому, чем кончился разбор.

type Listener = (event: string, session: { access_token: string } | null) => void;

const state = vi.hoisted(() => ({
  redirect: { recoveryToken: null as string | null, error: null as string | null },
  listener: null as Listener | null,
}));

vi.mock('../../lib/authRedirect', () => ({
  get authRedirect() { return state.redirect; },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        state.listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import ResetPassword from '../ResetPassword';

const renderPage = () => render(<MemoryRouter><ResetPassword /></MemoryRouter>);
const emit = (event: string, session: { access_token: string } | null) => act(() => { state.listener?.(event, session); });

describe('страница нового пароля', () => {
  beforeEach(() => {
    state.redirect = { recoveryToken: null, error: null };
    state.listener = null;
  });

  it('ссылка с ошибкой — сразу «ссылка недействительна» и путь к новой', () => {
    state.redirect = { recoveryToken: null, error: 'otp_expired' };
    renderPage();
    expect(screen.getByText(/n’est plus valable/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nouveau lien/i })).toHaveAttribute('href', '/forgot-password');
  });

  // Событие восстановления ушло раньше подписки: решает сессия из ссылки.
  it('событие пропущено, но сессия — из этой ссылки: можно задать пароль', () => {
    state.redirect = { recoveryToken: 'AT', error: null };
    renderPage();
    emit('INITIAL_SESSION', { access_token: 'AT' });
    expect(screen.getByLabelText(/Nouveau mot de passe/)).toBeInTheDocument();
  });

  it('событие пришло вовремя — можно задать пароль', () => {
    state.redirect = { recoveryToken: 'AT', error: null };
    renderPage();
    emit('PASSWORD_RECOVERY', { access_token: 'AT' });
    expect(screen.getByLabelText(/Nouveau mot de passe/)).toBeInTheDocument();
  });

  it('ссылка не прошла проверку (сессии из неё нет) — не ждём вечно', () => {
    state.redirect = { recoveryToken: 'AT', error: null };
    renderPage();
    emit('INITIAL_SESSION', null);
    expect(screen.getByText(/n’est plus valable/)).toBeInTheDocument();
  });

  // ГЛАВНОЕ ПО БЕЗОПАСНОСТИ. Вошедший человек, открывший /reset-password без
  // ссылки, не получает смену пароля без текущего: это обошло бы проверку в
  // ChangePassword (кто-то у незапертого компьютера).
  it('обычная сессия без ссылки восстановления не открывает смену пароля', () => {
    renderPage();
    emit('INITIAL_SESSION', { access_token: 'SOMEONE_LOGGED_IN' });
    expect(screen.queryByLabelText(/Nouveau mot de passe/)).not.toBeInTheDocument();
    expect(screen.getByText(/n’est plus valable/)).toBeInTheDocument();
  });

  it('пока разбор не кончился — «Vérification du lien…»', () => {
    state.redirect = { recoveryToken: 'AT', error: null };
    renderPage();
    expect(screen.getByText(/Vérification du lien/)).toBeInTheDocument();
  });
});
