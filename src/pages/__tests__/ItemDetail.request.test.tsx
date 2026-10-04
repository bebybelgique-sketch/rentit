import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Заявка со страницы вещи идёт мутацией (useCreateRental): после неё брони
// перечитываются. До 03.10 это был прямой вызов функции, и «Mes
// locations», открытые меньше минуты назад, показывали список без новой
// заявки. Отказ по-прежнему у кнопки — и только там: общий тост мутаций
// здесь молчит (src/lib/mutationErrors.ts).

const edge = vi.hoisted(() => ({ invoke: vi.fn() }));
const toastError = vi.hoisted(() => vi.fn());
// Снимок брони, который страница читает после заявки (readSent). null — не
// прочитался, и сводка остаётся на расчёте браузера.
const db = vi.hoisted(() => ({ bookingSnap: null as Record<string, unknown> | null }));

vi.mock('react-hot-toast', () => ({ default: { error: toastError, success: vi.fn() } }));
vi.mock('../../lib/edgeInvoke', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/edgeInvoke')>()),
  invokeEdge: edge.invoke,
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
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) c[m] = () => c;
    c.single = async () => ({ data: table === 'items' ? item : null, error: null });
    c.maybeSingle = async () => ({ data: table === 'bookings' ? db.bookingSnap : null, error: null });
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
import { createMutationCache } from '../../lib/mutationErrors';
import { EdgeError } from '../../lib/edgeInvoke';

let client: QueryClient;
const renderPage = () =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/item/i-1']}>
        <Routes><Route path="/item/:id" element={<ItemDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const pickTwoDaysAndSend = async () => {
  await screen.findByText('Perceuse Bosch');
  const next = screen.queryAllByRole('button').find((b) => b.textContent === '›');
  if (next) fireEvent.click(next);
  const days = Array.from(document.querySelectorAll('.cal-day.available')).filter((d) => /\d+/.test(d.textContent ?? ''));
  fireEvent.click(days[0]);
  fireEvent.click(days[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
};

describe('заявка со страницы вещи', () => {
  beforeEach(() => {
    client = new QueryClient({ mutationCache: createMutationCache() });
    edge.invoke.mockReset();
    toastError.mockReset();
    db.bookingSnap = null;
  });

  it('ушла — брони перечитываются', async () => {
    edge.invoke.mockResolvedValue({ booking_id: 'b-new' });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderPage();
    await pickTwoDaysAndSend();
    expect(await screen.findByText('Demande envoyée !')).toBeInTheDocument();
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ item_id: 'i-1' }));
    // Снимок не прочитался — сводка на расчёте браузера: 2 дня × €10.
    const summary = within(screen.getByTestId('sent-summary'));
    expect(summary.getByText('Location')).toBeInTheDocument();
    expect(summary.getAllByText('€20')).toHaveLength(2);
    await waitFor(() =>
      expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual(expect.arrayContaining([['bookings']])),
    );
  });

  it('сводка после заявки — весь выбор из брони и итог на месте', async () => {
    edge.invoke.mockResolvedValue({ booking_id: 'b-new' });
    renderPage();
    await screen.findByText('Perceuse Bosch');
    const next = screen.queryAllByRole('button').find((b) => b.textContent === '›');
    if (next) fireEvent.click(next);
    const days = Array.from(document.querySelectorAll('.cal-day.available')).filter((d) => /\d+/.test(d.textContent ?? ''));
    fireEvent.click(days[0]);
    fireEvent.click(days[1]);
    // Сервер записал не то, что считал браузер (владелец сменил цену):
    // экран обязан назвать записанное.
    db.bookingSnap = {
      total_price: 25, deposit_amount: 50,
      delivery_requested: true, delivery_fee: 15,
      operator_requested: true, operator_fee: 320, operator_days: 2,
    };
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    const summary = within(await screen.findByTestId('sent-summary'));
    expect(summary.getByText('€25')).toBeInTheDocument();
    expect(summary.getByText('Caution (remboursable)')).toBeInTheDocument();
    expect(summary.getByText('€50')).toBeInTheDocument();
    expect(summary.getByText('Opérateur (2 jours)')).toBeInTheDocument();
    expect(summary.getByText('€320')).toBeInTheDocument();
    expect(summary.getByText('Livraison')).toBeInTheDocument();
    expect(summary.getByText('€15')).toBeInTheDocument();
    expect(summary.getByText('Total à régler sur place')).toBeInTheDocument();
    expect(summary.getByText('€410')).toBeInTheDocument();
    expect(screen.getByText(/le règlement se fait en espèces au propriétaire/)).toBeInTheDocument();
  });

  it('отказ — причина у кнопки, и только она', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    edge.invoke.mockRejectedValue(new EdgeError('duplicate_request', 409));
    renderPage();
    await pickTwoDaysAndSend();
    expect(await screen.findByRole('alert')).toHaveTextContent('Vous avez déjà une demande en attente pour ces dates.');
    expect(toastError).not.toHaveBeenCalled();
  });
});
