import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * «Mes locations» и лента: метка «Nouveau» у брони с непрочитанным, и
 * непрочитанное гаснет, когда человек пришёл по ссылке на эту бронь.
 *
 * До 23.09 у сообщений не было «непрочитано» нигде: сообщение от
 * собеседника было невидимо, пока не откроешь именно эту бронь.
 */

const mocks = vi.hoisted(() => ({
  unread: new Set<string>(),
  mutate: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-1' };
  return { useAuth: () => ({ user }) };
});
const booking = (id: string) => ({
  id,
  item_id: 'it-1',
  item: { title: 'Perceuse', owner: { id: 'o-1', full_name: 'Propriétaire', rating_as_owner: null } },
  renter: { id: 'r-1', full_name: 'Locataire', rating_as_renter: null },
  start_date: '2026-09-20',
  end_date: '2026-09-22',
  status: 'confirmed',
});
vi.mock('../../hooks/useRentals', () => ({
  useRentals: () => ({ data: [booking('mine-1'), booking('mine-2')], isLoading: false, error: null }),
}));
vi.mock('../../hooks/useRentalsAsOwner', () => ({
  useRentalsAsOwner: () => ({ data: [], isLoading: false, error: null }),
}));
vi.mock('../../hooks/useCatalogHasItems', () => ({ useCatalogHasItems: () => ({ catalogIsEmpty: false }) }));
vi.mock('../../hooks/mutations/useTransitionBooking', () => ({
  useTransitionBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../components/booking/BookingThread', () => ({ default: () => null }));
vi.mock('../../components/booking/BookingOwnerActions', () => ({ default: () => null }));
vi.mock('../../hooks/useActivity', () => ({
  useUnreadActivity: () => ({ data: { count: mocks.unread.size, bookingIds: mocks.unread } }),
  useMarkActivityRead: () => ({ mutate: mocks.mutate }),
}));

import MyRentals from '../MyRentals';

const renderAt = (path: string, client = new QueryClient()) => render(
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[path]}><MyRentals /></MemoryRouter>
  </QueryClientProvider>,
);

// Перечитывание по ссылке — обещание: даём ему завершиться.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unread = new Set();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('«Mes locations»: непрочитанное у брони', () => {
  it('метка «Nouveau» — только у брони с непрочитанным', () => {
    mocks.unread = new Set(['mine-2']);
    renderAt('/my-rentals');
    const marks = screen.getAllByRole('button', { name: 'Nouveau' });
    expect(marks).toHaveLength(1);
    expect(document.getElementById('booking-mine-2')).toContainElement(marks[0]);
  });

  it('нажатие на метку — прочитано по этой брони', () => {
    mocks.unread = new Set(['mine-2']);
    renderAt('/my-rentals');
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    expect(mocks.mutate).toHaveBeenCalledWith({ bookingId: 'mine-2' });
  });

  // Гаснет после перечитывания списков, когда бронь на экране.
  it('пришёл по ссылке на бронь (лента, push) — её непрочитанное гаснет само', async () => {
    mocks.unread = new Set(['mine-1']);
    renderAt('/my-rentals?booking=mine-1');
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith({ bookingId: 'mine-1' }));
  });

  it('по ссылке на бронь без непрочитанного — запроса нет', async () => {
    renderAt('/my-rentals?booking=mine-1');
    await settle();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  // Ссылка — почти всегда о том, что сделала вторая сторона: свежие по
  // часам списки могли ещё не знать о новой заявке или сообщении.
  it('по ссылке перечитываются списки, переписка и фото этой брони', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderAt('/my-rentals?booking=mine-1', client);
    await settle();
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([
      ['bookings'], ['bookingMessages', 'mine-1'], ['bookingPhotos', 'mine-1'],
    ]));
  });

  // До 03.10 метка гасла сразу: событие о брони, которой в устаревшем
  // списке ещё не было, считалось увиденным, а человек её так и не видел.
  it('брони нет и после перечитывания — метка не гаснет, страница говорит почему', async () => {
    mocks.unread = new Set(['ghost']);
    renderAt('/my-rentals?booking=ghost');
    expect(await screen.findByRole('status')).toHaveTextContent('Cette réservation n’apparaît pas dans ce compte');
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it('бронь нашлась — строки «нет в этой учётке» нет', async () => {
    renderAt('/my-rentals?booking=mine-1');
    await settle();
    expect(screen.queryByText(/n’apparaît pas dans ce compte/)).not.toBeInTheDocument();
  });
});
