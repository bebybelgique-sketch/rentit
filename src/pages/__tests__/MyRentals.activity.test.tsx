import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><MyRentals /></MemoryRouter>);

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

  it('пришёл по ссылке на бронь (лента, push) — её непрочитанное гаснет само', () => {
    mocks.unread = new Set(['mine-1']);
    renderAt('/my-rentals?booking=mine-1');
    expect(mocks.mutate).toHaveBeenCalledWith({ bookingId: 'mine-1' });
  });

  it('по ссылке на бронь без непрочитанного — запроса нет', () => {
    renderAt('/my-rentals?booking=mine-1');
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
