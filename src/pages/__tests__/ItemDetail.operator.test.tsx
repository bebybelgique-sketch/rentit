import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// «Avec opérateur» на странице вещи (миграция 54): предложение видно среди
// условий, выбор добавляет строку в разбор и уходит в заявку флагом — сумму
// сервер берёт из вещи. Ставки — из настоящего объявления 03.10: машина
// 90 € в день; оператор 160 € в день.

const edge = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../lib/edgeInvoke', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/edgeInvoke')>()),
  invokeEdge: edge.invoke,
}));
vi.mock('../../lib/supabase', () => {
  const item = {
    id: 'i-1', owner_id: 'u-owner', title: 'Mini-pelle 1 t', description: 'Kubota, 3 godets', price_per_day: 90,
    price_3days: null, price_week: null, price_weekend: null, deposit: 0, late_fee_per_day: null,
    delivery_fee: null, delivery_radius_km: null, operator_fee_per_day: 160, category: 'construction',
    condition: 'good', address: '1300 Wavre', lat: null, lng: null, available: true, quantity: 1,
    min_notice_days: 0, buffer_days: 0, photos: [],
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

describe('оператор на странице вещи', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    edge.invoke.mockReset().mockResolvedValue({ booking_id: 'b-new' });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('предложение видно среди условий', async () => {
    renderPage();
    expect(await screen.findByText('Avec opérateur : +€160.00 / jour')).toBeInTheDocument();
  });

  it('выбор оператора — строка в разборе и флаг в заявке', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    // Вторник 13 — среда 14 октября: два дня.
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
    expect(screen.getByText('€320.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    await screen.findByText('Demande envoyée !');
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ operator_requested: true }));
  });

  // Дни оператора — не дни аренды (миграция 56): сб–пн — пакет выходных с
  // возвратом в понедельник, а оператор работает два дня.
  it('дни оператора задаёт арендатор — сумма и заявка по ним', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    // Суббота 10 — понедельник 12 октября: три дня брони.
    fireEvent.click(day(10));
    fireEvent.click(day(12));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    expect(await screen.findByText('Opérateur €160.00 × 3 j')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '2' } });
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    await screen.findByText('Demande envoyée !');
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ operator_requested: true, operator_days: 2 }));
  });

  it('дней оператора не больше, чем дней брони', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '9' } });
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
  });

  it('без выбора — в заявке оператора нет', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    await screen.findByText('Demande envoyée !');
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ operator_requested: false }));
  });
});
