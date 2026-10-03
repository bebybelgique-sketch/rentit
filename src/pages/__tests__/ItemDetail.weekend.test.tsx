import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Тариф «выходные» на странице вещи: виден среди тарифов, и выбранные
// суббота–воскресенье считаются пакетом — тем же расчётом, что у сервера
// (supabase/functions/_shared/pricing.ts). Ставки — из настоящего
// объявления 03.10: 90 € день, 350 € неделя, 150 € выходные.

vi.mock('../../lib/supabase', () => {
  const item = {
    id: 'i-1', owner_id: 'u-owner', title: 'Mini-pelle 1 t', description: 'Kubota, 3 godets', price_per_day: 90,
    price_3days: null, price_week: 350, price_weekend: 150, deposit: 200, late_fee_per_day: null,
    delivery_fee: 75, delivery_radius_km: null, category: 'construction', condition: 'good',
    address: '1300 Wavre', lat: null, lng: null, available: true, quantity: 1, min_notice_days: 0,
    buffer_days: 0, photos: [],
    users: { id: 'u-owner', full_name: 'Loueur', avatar_url: null, phone_verified: false, rating_as_owner: null, is_pro: false },
  };
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) c[m] = () => c;
    c.single = async () => ({ data: table === 'items' ? item : null, error: null });
    c.maybeSingle = async () => ({ data: null, error: null });
    c.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
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

const day = (n: number) =>
  Array.from(document.querySelectorAll('.cal-day.available')).find((d) => d.textContent === String(n)) as HTMLElement;

describe('тариф выходных на странице вещи', () => {
  // Календарь открывается на текущем месяце. Октябрь 2026: 10-е — суббота,
  // 11-е — воскресенье, 13-е — вторник.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('виден среди тарифов — с окном сб–пн', async () => {
    renderPage();
    expect(await screen.findByText('€150.00 / week-end (sam. → lun.)')).toBeInTheDocument();
  });

  it('суббота–воскресенье — пакет за 150, а не 2 × 90', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(10));
    fireEvent.click(day(11));
    expect(await screen.findByText('€150.00 × 1 week-end')).toBeInTheDocument();
    expect(screen.queryByText(/€90\.00 × 2 jours/)).not.toBeInTheDocument();
  });

  it('будние вторник–среда — по дням, пакет выходных их не касается', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    expect(await screen.findByText('€90.00 × 2 jours')).toBeInTheDocument();
    expect(screen.queryByText(/week-end$/)).not.toBeInTheDocument();
  });
});
