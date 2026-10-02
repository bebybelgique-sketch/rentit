import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Отказ одного действия не переживает следующее. Мутаций на странице две —
// «скрыть» и «удалить», а react-query сбрасывает отказ мутации, только когда
// она же начинается заново. До 03.10 неудачное «скрыть», а за ним удачное
// «удалить» оставляли над списком причину от прошлого действия.

let items: Array<Record<string, unknown>> = [];
const hideFn = vi.hoisted(() => vi.fn());
const deleteFn = vi.hoisted(() => vi.fn());

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
// Настоящие мутации react-query — проверяется именно их состояние отказа.
vi.mock('../../hooks/mutations/useSetItemAvailability', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return { useSetItemAvailability: () => useMutation({ mutationFn: hideFn }) };
});
vi.mock('../../hooks/mutations/useDeleteItem', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return { useDeleteItem: () => useMutation({ mutationFn: deleteFn }) };
});

import MyItems from '../MyItems';
import { UserFacingError } from '../../lib/errorText';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><MyItems /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('«Мои вещи»: причина отказа — только от последнего действия', () => {
  let confirmSpy: MockInstance<[message?: string | undefined], boolean>;

  beforeEach(() => {
    items = [{
      id: 'i-1', title: 'Perceuse', category: 'power_tools', available: true,
      price_per_day: 10, deposit: 0, photos: [], bookings: [],
    }];
    hideFn.mockReset();
    deleteFn.mockReset();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => confirmSpy.mockRestore());

  it('«скрыть» не прошло, «удалить» прошло — старой причины над списком нет', async () => {
    hideFn.mockRejectedValue(new UserFacingError('Masquage impossible'));
    deleteFn.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Masquage impossible');

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(deleteFn).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('«удалить» не прошло, «скрыть» прошло — старой причины над списком нет', async () => {
    deleteFn.mockRejectedValue(new UserFacingError('Suppression impossible'));
    hideFn.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Suppression impossible');

    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    await waitFor(() => expect(hideFn).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
