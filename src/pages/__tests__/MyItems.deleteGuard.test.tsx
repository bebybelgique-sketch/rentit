import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Удаление вещи уносит её брони каскадом (bookings.item_id … on delete
// cascade): чужая заявка или подтверждённая бронь исчезала молча — без
// отмены, без уведомления, вместе с перепиской и фото. Пока вещь держит
// живые брони, удалить её нельзя; скрыть — можно всегда.

let items: Array<Record<string, unknown>> = [];
const deleteMock = vi.hoisted(() => vi.fn());

// lib/supabase бросает при загрузке без VITE_SUPABASE_URL — нужна заглушка
// (см. MyItems.emptyCta.test.tsx).
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

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('../../hooks/useOwnerItems', () => ({
  useOwnerItems: () => ({ data: items, isLoading: false, isError: false }),
}));
vi.mock('../../hooks/mutations/useSetItemAvailability', () => ({
  useSetItemAvailability: () => ({ mutate: vi.fn(), error: null }),
}));
vi.mock('../../hooks/mutations/useDeleteItem', () => ({
  useDeleteItem: () => ({ mutate: deleteMock, error: null }),
}));

import MyItems from '../MyItems';

// Карточка с бронями рисует кнопки владельца, а им нужен QueryClient.
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><MyItems /></MemoryRouter>
    </QueryClientProvider>,
  );

const booking = (status: string) => ({
  id: `b-${status}`, item_id: 'i-1', renter_id: 'u-2', status,
  start_date: '2026-10-20', end_date: '2026-10-21', total_price: 20, total_days: 2,
  request_message: null, created_at: '2026-10-01T10:00:00Z',
  renter: { id: 'u-2', full_name: 'Julien Vermeulen', avatar_url: null },
});

const itemWith = (...statuses: string[]) => ({
  id: 'i-1', title: 'Perceuse', category: 'power_tools', available: true,
  price_per_day: 10, deposit: 0, photos: [], bookings: statuses.map(booking),
});

describe('«Мои вещи»: удаление вещи с живыми бронями', () => {
  let alertSpy: MockInstance<[message?: any], void>;
  let confirmSpy: MockInstance<[message?: string | undefined], boolean>;

  beforeEach(() => {
    deleteMock.mockReset();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it.each(['pending_approval', 'confirmed', 'active'])(
    'бронь в статусе %s — удаление не идёт, человеку предложено скрыть', (status) => {
      items = [itemWith(status)];
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
      expect(deleteMock).not.toHaveBeenCalled();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/Masquez-la plutôt/));
    },
  );

  // Закрытые брони вещь не держат: удаление — как раньше, с подтверждением.
  it('только закрытые брони — обычное подтверждение и удаление', () => {
    items = [itemWith('completed', 'cancelled', 'rejected', 'expired')];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith({ id: 'i-1' });
  });
});
