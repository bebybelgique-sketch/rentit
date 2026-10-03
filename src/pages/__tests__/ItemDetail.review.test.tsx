import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Отзыв о вещи на её странице. До 03.10 сбой записи проглатывался:
// кнопка возвращалась в «Envoyer», и человек не узнавал, что отзыв не
// записан. А арендатор, бравший вещь дважды, формы не видел вовсе:
// maybeSingle() на двух завершённых арендах отдаёт ошибку.

const db = vi.hoisted(() => ({
  insertError: null as null | { code?: string; message: string },
  bookingsCalls: [] as string[],
}));

vi.mock('../../lib/supabase', () => {
  const item = {
    id: 'i-1', owner_id: 'u-owner', title: 'Perceuse Bosch', description: 'Perceuse 18 V', price_per_day: 10,
    price_3days: null, price_week: null, deposit: 0, late_fee_per_day: null, delivery_fee: null,
    delivery_radius_km: null, category: 'power_tools', condition: 'good', address: '1457 Walhain',
    lat: null, lng: null, available: true, quantity: 1, min_notice_days: 0, buffer_days: 0, photos: [],
    users: { id: 'u-owner', full_name: 'Julien V.', avatar_url: null, phone_verified: false, rating_as_owner: null, is_pro: false },
  };
  const chain = (table: string) => {
    const calls: string[] = [];
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) {
      c[m] = (...args: unknown[]) => { calls.push(`${m}:${String(args[0])}`); return c; };
    }
    c.single = async () => ({ data: table === 'items' ? item : null, error: null });
    c.maybeSingle = async () => {
      if (table === 'bookings') {
        db.bookingsCalls.push(calls.join(' '));
        return { data: { id: 'b-1' }, error: null };
      }
      return { data: null, error: null };
    };
    c.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    c.insert = async () => ({ error: db.insertError });
    return c;
  };
  return {
    supabase: {
      from: (table: string) => chain(table),
      rpc: async () => ({ data: null, error: null }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      functions: { invoke: vi.fn() },
    },
  };
});
vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-renter' };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useMyInvite', () => ({ useMyInvite: () => ({ data: null }) }));
vi.mock('../../components/push/PushOfferCard', () => ({ default: () => null }));

import ItemDetail from '../ItemDetail';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/item/i-1']}>
        <Routes><Route path="/item/:id" element={<ItemDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const submitReview = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Envoyer l'avis/i }));
};

describe('отзыв о вещи на её странице', () => {
  beforeEach(() => {
    db.insertError = null;
    db.bookingsCalls = [];
  });

  it('запись не удалась — причина под формой, а не тишина', async () => {
    db.insertError = { code: '42501', message: 'new row violates row-level security policy' };
    renderPage();
    await submitReview();
    expect(await screen.findByRole('alert')).toHaveTextContent("L'avis n'a pas pu être enregistré");
  });

  it('отзыв на эту аренду уже есть — «вы уже оценили», а не «ошибка»', async () => {
    db.insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    renderPage();
    await submitReview();
    expect(await screen.findByRole('alert')).toHaveTextContent('Vous avez déjà laissé cet avis');
  });

  it('записалось — спасибо, ошибки нет', async () => {
    renderPage();
    await submitReview();
    expect(await screen.findByText(/merci/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Брал вещь дважды — оценивается последняя аренда, а не ошибка на двух строках.
  it('берётся последняя завершённая аренда', async () => {
    renderPage();
    await submitReview();
    await screen.findByText(/merci/i);
    expect(db.bookingsCalls.length).toBeGreaterThan(0);
    for (const call of db.bookingsCalls) expect(call).toContain('order:end_date');
    for (const call of db.bookingsCalls) expect(call).toContain('limit:1');
  });
});
