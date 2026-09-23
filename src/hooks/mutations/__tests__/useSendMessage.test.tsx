import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Сообщение → уведомление собеседнику.
 *
 * Серверного события у вставки нет, поэтому notify-message зовёт клиент —
 * и зовёт с id ТОЛЬКО ЧТО записанного сообщения. Отказ уведомления не
 * превращает удачную отправку в неудачную.
 */

const mocks = vi.hoisted(() => ({
  insertResult: { data: { id: 'msg-1' } as { id: string } | null, error: null as { message: string } | null },
  inserted: null as unknown,
  notifyMessageSent: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn((rows: unknown) => {
        mocks.inserted = rows;
        return { select: () => ({ single: async () => mocks.insertResult }) };
      }),
    })),
  },
}));
vi.mock('../../../lib/push', () => ({ notifyMessageSent: mocks.notifyMessageSent }));

import { useSendMessage } from '../useSendMessage';

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useSendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    mocks.insertResult = { data: { id: 'msg-1' }, error: null };
    mocks.inserted = null;
  });

  it('после записи зовёт уведомление с id этого сообщения', async () => {
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    result.current.mutate({ bookingId: 'b1', senderId: 'u1', body: '  Où se voit-on ?  ' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.inserted).toEqual([{ booking_id: 'b1', sender_id: 'u1', body: 'Où se voit-on ?' }]);
    expect(mocks.notifyMessageSent).toHaveBeenCalledWith('msg-1');
  });

  it('запись не удалась — уведомления нет', async () => {
    mocks.insertResult = { data: null, error: { message: 'denied' } };
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    result.current.mutate({ bookingId: 'b1', senderId: 'u1', body: 'x' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.notifyMessageSent).not.toHaveBeenCalled();
  });

  it('пустое сообщение не уходит вовсе', async () => {
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    result.current.mutate({ bookingId: 'b1', senderId: 'u1', body: '   ' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.inserted).toBeNull();
    expect(mocks.notifyMessageSent).not.toHaveBeenCalled();
  });
});
