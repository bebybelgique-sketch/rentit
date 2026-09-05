import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminStats } from '../useAdminStats';

// Счётчики площадки обязаны считаться НА СЕРВЕРЕ. Под правами самого
// администратора RLS отдаёт ему только его собственные брони и платежи —
// вкладка Stats показывала личные цифры с общей подписью.

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke } },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useAdminStats', () => {
  beforeEach(() => {
    invoke.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('спрашивает счётчики у admin-action', async () => {
    invoke.mockResolvedValue({
      data: { ok: true, stats: { users: 12, items: 7, bookings: 30, completed: 9 } },
      error: null,
    });

    const { result } = renderHook(() => useAdminStats(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invoke).toHaveBeenCalledWith('admin-action', { body: { type: 'get_stats' } });
    expect(result.current.data).toEqual({ users: 12, items: 7, bookings: 30, completed: 9 });
  });

  it('до подтверждения роли запрос не уходит', () => {
    // Иначе каждый заход постороннего на /admin давал бы 403 в консоли —
    // шум, в котором теряются настоящие ошибки.
    renderHook(() => useAdminStats(false), { wrapper });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('отказ доезжает кодом, а не служебной фразой', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        context: new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }),
      }),
    });

    const { result } = renderHook(() => useAdminStats(true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('forbidden');
  });
});
