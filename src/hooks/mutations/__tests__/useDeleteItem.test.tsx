// src/hooks/mutations/__tests__/useDeleteItem.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteItem } from '../useDeleteItem';
import { bookingKeys, itemKeys } from '../../../lib/queryKeys';

const mocks = vi.hoisted(() => {
  const eq = vi.fn();
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return { from, del, eq };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useDeleteItem', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mocks.from.mockClear();
    mocks.del.mockClear();
    mocks.eq.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('удаляет по id своей вещи', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1' });
    });

    expect(mocks.from).toHaveBeenCalledWith('items');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('выбрасывает карточку вещи из кэша и перечитывает списки вещей и броней', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: null });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const removeQueries = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1' });
    });

    // Инвалидация оставила бы в памяти строку, которой в базе больше нет, и
    // ItemDetail перечитал бы её в PGRST116.
    await waitFor(() => expect(removeQueries).toHaveBeenCalledWith({ queryKey: itemKeys.one('item-1') }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all });
    // bookings.item_id — внешний ключ с ON DELETE CASCADE: брони вещи
    // удаляются вместе с ней, поэтому устарели оба списка.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingKeys.all });
  });

  it('отказ базы доходит до страницы текстом', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: 'cannot delete: item has active bookings' } });
    const removeQueries = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useDeleteItem(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('cannot delete: item has active bookings');
    // Вещь осталась в базе — значит и в кэше она обязана остаться: список
    // не должен терять строку из-за отказа.
    expect(removeQueries).not.toHaveBeenCalled();
  });
});
