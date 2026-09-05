// src/hooks/mutations/__tests__/useSetItemAvailability.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetItemAvailability } from '../useSetItemAvailability';
import { itemKeys } from '../../../lib/queryKeys';

const mocks = vi.hoisted(() => {
  const eq = vi.fn();
  // Подпись с параметром намеренно: по ней типизируются mock.calls, и
  // проверка отправленных колонок компилируется без приведений.
  const update = vi.fn((_values: Record<string, unknown>) => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { from, update, eq };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useSetItemAvailability', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mocks.from.mockClear();
    mocks.update.mockClear();
    mocks.eq.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('шлёт только колонку available — и ровно то значение, которое попросили', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useSetItemAvailability(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', available: false });
    });

    expect(mocks.from).toHaveBeenCalledWith('items');
    // location — generated-колонка (geography из lat/lng): писать в неё
    // нельзя, Postgres отверг бы запрос целиком. Тот же класс, что
    // image_url в PR #19.
    expect(mocks.update).toHaveBeenCalledWith({ available: false });
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('location');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'item-1');
  });

  it('после успеха перечитывает списки вещей и карточку этой вещи', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: null });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetItemAvailability(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', available: true });
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all }));
    // Карточка вещи живёт в ключе единственного числа, который префикс
    // списков не задевает: без этой строки ItemDetail показывал бы скрытую
    // вещь доступной до перезагрузки.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.one('item-1') });
  });

  it('отказ базы доходит до страницы текстом, а не тихим успехом', async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } });
    // Шпион ставится ДО действия: поставленный после, он не увидел бы ни
    // одного вызова и проверка «кэш не тронут» прошла бы впустую.
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetItemAvailability(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', available: true }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('new row violates row-level security policy');
    expect(invalidate).not.toHaveBeenCalled();
  });
});
