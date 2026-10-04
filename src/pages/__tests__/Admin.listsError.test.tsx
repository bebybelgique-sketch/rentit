import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Сбой чтения списков в админке — это сбой, а не «данных нет» (аудит 04.10).
// До этого поле error не читалось, и отказ показывался пустым списком.

const db = vi.hoisted(() => ({ listError: null as { message: string } | null, listCalls: 0 }));

vi.mock('../../lib/supabase', () => {
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    let roleQuery = false;
    c.select = (cols: string) => { roleQuery = table === 'users' && cols === 'role'; return c; };
    for (const m of ['eq', 'order', 'limit']) c[m] = () => c;
    c.single = async () => ({ data: { role: 'admin' }, error: null });
    c.then = (resolve: (v: unknown) => unknown) => {
      if (!roleQuery) db.listCalls += 1;
      const row = table === 'items'
        ? { id: 'i-1', title: 'Perceuse', price_per_day: 10, category: 'power_tools', available: true, users: { full_name: 'Julien' } }
        : { id: 'u-2', full_name: 'Julien', role: 'user', created_at: '2026-10-01', phone_verified: false };
      return resolve(db.listError ? { data: null, error: db.listError } : { data: [row], error: null });
    };
    return c;
  };
  return {
    supabase: {
      from: (table: string) => chain(table),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      functions: { invoke: vi.fn() },
    },
  };
});
vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-admin' };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useAdminStats', () => ({
  useAdminStats: () => ({ isLoading: false, isError: false, data: { users: 2, items: 1, bookings: 0, completed: 0 } }),
}));

import Admin from '../Admin';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><Admin /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('админка: сбой чтения списков', () => {
  beforeEach(() => {
    db.listError = null;
    db.listCalls = 0;
  });

  it('сбой — экран ошибки с повтором, а не пустой список', async () => {
    db.listError = { message: 'boom' };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Annonces' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Les listes n'ont pas pu être chargées.");
    const callsBefore = db.listCalls;
    db.listError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Perceuse')).toBeInTheDocument();
    expect(db.listCalls).toBeGreaterThan(callsBefore);
  });

  it('прочиталось — список и подписи по-французски', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Annonces' }));
    expect(await screen.findByText('Perceuse')).toBeInTheDocument();
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masquer' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
