import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminAction } from '../useAdminAction';

// Проверяем не «мутация вызвалась», а то, ради чего она заведена:
// действие уходит в edge-функцию (а не прямым update, который база всё
// равно отвергает), и отказ доезжает до интерфейса КОДОМ.

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  supabase: { functions: { invoke } },
}));

const ADMIN = '11111111-1111-4111-8111-111111111111';

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useAdminAction', () => {
  beforeEach(() => {
    invoke.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('шлёт действие в admin-action целиком', async () => {
    invoke.mockResolvedValue({ data: { ok: true, user: { id: ADMIN, role: 'admin' } }, error: null });

    const { result } = renderHook(() => useAdminAction(), { wrapper });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({ type: 'set_user_role', user_id: ADMIN, role: 'admin' });
    });

    expect(invoke).toHaveBeenCalledWith('admin-action', {
      body: { type: 'set_user_role', user_id: ADMIN, role: 'admin' },
    });
    // Показывать надо ПРИШЕДШУЮ строку: экран, нарисованный по намерению,
    // расходится с базой ровно в тех случаях, когда это важно.
    expect(returned).toEqual({ ok: true, user: { id: ADMIN, role: 'admin' } });
  });

  it('снятие прав с себя приходит отдельным кодом', async () => {
    // Предохранитель стоит на сервере, но интерфейс обязан показать
    // человеку именно эту причину, а не общий «сбой обновления».
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        context: new Response(JSON.stringify({ error: 'cannot_demote_self' }), { status: 400 }),
      }),
    });

    const { result } = renderHook(() => useAdminAction(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ type: 'set_user_role', user_id: ADMIN, role: 'user' })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('cannot_demote_self');
  });

  it('скрытие объявления сбрасывает кэш витрины и страницы вещи', async () => {
    // Иначе человек откроет ссылку из поиска и увидит вещь, которой в
    // каталоге уже нет.
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    invoke.mockResolvedValue({ data: { ok: true, item: { id: 'i1', available: false } }, error: null });

    const { result } = renderHook(() => useAdminAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        type: 'set_item_available',
        item_id: '22222222-2222-4222-8222-222222222222',
        available: false,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['items'] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['item', '22222222-2222-4222-8222-222222222222'],
    });
  });
});
