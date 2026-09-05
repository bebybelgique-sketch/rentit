// src/hooks/__tests__/useOwnerItems.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOwnerItems } from '../useOwnerItems';
import { itemKeys } from '../../lib/queryKeys';

const mocks = vi.hoisted(() => {
  const order = vi.fn();
  const eq = vi.fn(() => ({ order }));
  // Подпись с параметром намеренно: по ней типизируются mock.calls, и
  // проверка select-строки компилируется без приведений.
  const select = vi.fn((_columns: string) => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, order };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useOwnerItems', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mocks.from.mockClear();
    mocks.select.mockClear();
    mocks.eq.mockClear();
    mocks.order.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  // Ключ — половина дела. До 06.09 этот хук объявлял ['bookings', userId]:
  // вещи, названные бронями, и ни одна мутация их не инвалидировала.
  it('объявляет ключ вещей владельца из общего справочника', async () => {
    mocks.order.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useOwnerItems('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const declared = queryClient.getQueryCache().getAll().map(q => q.queryKey);
    expect(declared).toContainEqual(itemKeys.asOwner('user-1'));
    expect(declared.some(key => key[0] === 'bookings')).toBe(false);
  });

  it('просит у базы брони вместе с профилем арендатора', async () => {
    mocks.order.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useOwnerItems('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.from).toHaveBeenCalledWith('items');
    const selectString = String(mocks.select.mock.calls[0][0]);
    expect(selectString).toContain('bookings(');
    expect(selectString).toContain('renter:users!renter_id(');
    expect(mocks.eq).toHaveBeenCalledWith('owner_id', 'user-1');
  });

  it('отдаёт строку как есть: photos не переписываются и renter не подставляется', async () => {
    // Маппер, который здесь стоял, переписывал jsonb-колонку photos в
    // string[] и подставлял renter: null. С типами из схемы оба действия
    // лишние, а снимки читает photosOf по месту показа.
    const row = {
      id: 'item-1',
      title: 'Perceuse',
      photos: [null, 'https://example.com/drill.jpg'],
      bookings: [
        { id: 'booking-1', status: 'pending_approval', start_date: '2026-09-10', end_date: '2026-09-12' },
      ],
    };
    mocks.order.mockResolvedValue({ data: [row], error: null });

    const { result } = renderHook(() => useOwnerItems('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([row]);
    expect(result.current.data?.[0].photos).toEqual([null, 'https://example.com/drill.jpg']);
    expect(result.current.data?.[0].bookings[0]).not.toHaveProperty('renter');
  });

  it('без пользователя не ходит в базу', async () => {
    const { result } = renderHook(() => useOwnerItems(undefined), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('отказ базы становится отказом запроса, а не пустым списком', async () => {
    mocks.order.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const { result } = renderHook(() => useOwnerItems('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('permission denied');
  });
});
