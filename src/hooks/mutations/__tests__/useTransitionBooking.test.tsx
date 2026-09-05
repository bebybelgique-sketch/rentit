// src/hooks/mutations/__tests__/useTransitionBooking.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTransitionBooking } from '../useTransitionBooking';
import { bookingKeys, itemKeys } from '../../../lib/queryKeys';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useTransitionBooking', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mocks.invoke.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('возвращает статус ИЗ ОТВЕТА сервера, а не из своей таблицы переходов', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, status: 'active' }, error: null });

    const { result } = renderHook(() => useTransitionBooking(), { wrapper });
    let status = '';
    await act(async () => {
      status = await result.current.mutateAsync({ bookingId: 'booking-1', action: 'handover' });
    });

    expect(status).toBe('active');
    expect(mocks.invoke).toHaveBeenCalledWith('transition-booking', {
      body: { booking_id: 'booking-1', action: 'handover', reason: null },
    });
  });

  it('причину передаёт в теле, а не подменяет её null', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, status: 'cancelled' }, error: null });

    const { result } = renderHook(() => useTransitionBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1', action: 'cancel', reason: 'Уехал' });
    });

    expect(mocks.invoke).toHaveBeenCalledWith('transition-booking', {
      body: { booking_id: 'booking-1', action: 'cancel', reason: 'Уехал' },
    });
  });

  // Ключи — суть правки 06.09: до неё хук инвалидировал два разных имени
  // списков броней и мёртвый ключ занятых дат, а список «Моих вещей»
  // (['items', 'asOwner', userId]) не трогал вовсе.
  it('после перехода инвалидирует брони и вещи — ключи из общего справочника', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, status: 'completed' }, error: null });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useTransitionBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1', action: 'complete' });
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingKeys.all }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all });
    // Ровно два вызова: ни мёртвого ключа занятых дат, ни прежних двух имён
    // списков броней здесь больше нет — оба взгляда ловит один префикс.
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('2xx без статуса — отказ, а не «почти получилось»', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });

    const { result } = renderHook(() => useTransitionBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1', action: 'handover' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Состояние брони неизвестно — рисовать по догадке нельзя.
    expect(result.current.error?.message).toBe('internal_error');
  });

  it('отказ 409 доходит кодом из тела ответа', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: new Response(JSON.stringify({ error: 'booking_changed' }), { status: 409 }),
      }),
    });

    const { result } = renderHook(() => useTransitionBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1', action: 'handover' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('booking_changed');
  });
});
