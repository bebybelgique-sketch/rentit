import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Лента двигает брони: новое событие от второй стороны — и списки броней,
// вещи с бронями, переписка и фото перечитываются. До 03.10 колокольчик
// говорил «новое сообщение», а открытая переписка его не показывала, пока
// человек не уйдёт со страницы.

type Row = { booking_id: string; created_at: string };
const unread = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        is: () => ({
          order: () => ({
            limit: async () => ({ data: unread.rows, error: null }),
          }),
        }),
      }),
    }),
  },
}));

import { useActivityRefreshesBookings } from '../useActivity';
import { activityKeys } from '../../lib/queryKeys';

const at = (time: string, bookingId = 'b-1'): Row => ({ booking_id: bookingId, created_at: `2026-10-03T${time}:00+00:00` });

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ userId }) => useActivityRefreshesBookings(userId), {
    wrapper,
    initialProps: { userId: 'u-1' },
  });
  // Ключи, которые погасил хук. Опрос ленты сам ничего не гасит.
  const refreshed = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  // Опрос ленты — раз в минуту или по push; здесь — по команде.
  const poll = (userId = 'u-1') =>
    act(() => client.refetchQueries({ queryKey: activityKeys.unread(userId) }));
  const firstRead = (userId = 'u-1') =>
    waitFor(() => expect(client.getQueryState(activityKeys.unread(userId))?.status).toBe('success'));
  return { hook, refreshed, poll, firstRead };
};

const EVERYTHING_THE_OTHER_SIDE_WRITES = [['bookings'], ['items'], ['bookingMessages'], ['bookingPhotos']];

describe('лента двигает брони', () => {
  beforeEach(() => {
    unread.rows = [];
  });

  it('первое чтение после входа ничего не гасит — списки и так грузятся', async () => {
    unread.rows = [at('10:00')];
    const { refreshed, firstRead } = setup();
    await firstRead();
    await act(async () => {});
    expect(refreshed()).toEqual([]);
  });

  it('новое событие — устаревает всё, что пишет вторая сторона', async () => {
    unread.rows = [at('10:00')];
    const { refreshed, poll, firstRead } = setup();
    await firstRead();
    unread.rows = [at('10:05', 'b-2'), at('10:00')];
    await poll();
    await waitFor(() => expect(refreshed()).toEqual(expect.arrayContaining(EVERYTHING_THE_OTHER_SIDE_WRITES)));
  });

  it('опрос без нового события ничего не гасит', async () => {
    unread.rows = [at('10:00')];
    const { refreshed, poll, firstRead } = setup();
    await firstRead();
    await poll();
    expect(refreshed()).toEqual([]);
  });

  // Прочитанное уходит из выборки и сдвигает сигнал назад: это не событие.
  // А следующее настоящее событие — событие, хоть оно и старше прочитанных.
  it('прочитал — тишина; пришло новое — гасит', async () => {
    unread.rows = [at('10:05'), at('10:00')];
    const { refreshed, poll, firstRead } = setup();
    await firstRead();
    unread.rows = [];
    await poll();
    expect(refreshed()).toEqual([]);

    unread.rows = [at('10:30')];
    await poll();
    await waitFor(() => expect(refreshed()).toEqual(expect.arrayContaining(EVERYTHING_THE_OTHER_SIDE_WRITES)));
  });

  // Пустая лента при входе — не повод пропустить первое же событие.
  it('при входе непрочитанного нет — первое же событие гасит', async () => {
    const { refreshed, poll, firstRead } = setup();
    await firstRead();
    unread.rows = [at('10:00')];
    await poll();
    await waitFor(() => expect(refreshed()).toEqual(expect.arrayContaining(EVERYTHING_THE_OTHER_SIDE_WRITES)));
  });

  it('другой вход — отсчёт заново, его первое чтение ничего не гасит', async () => {
    unread.rows = [at('10:00')];
    const { hook, refreshed, firstRead } = setup();
    await firstRead();
    unread.rows = [at('11:00')];
    hook.rerender({ userId: 'u-2' });
    await firstRead('u-2');
    await act(async () => {});
    expect(refreshed()).toEqual([]);
  });
});
