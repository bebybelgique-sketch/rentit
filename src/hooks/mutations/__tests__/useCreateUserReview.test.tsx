import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateUserReview } from '../useCreateUserReview';

let mockInsertError: any = null;
const insertSpy = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn((rows: any) => {
        insertSpy(rows);
        return Promise.resolve({ error: mockInsertError });
      }),
    })),
  },
}));

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const params = {
  bookingId: 'b1', itemId: 'i1', fromUserId: 'u-renter', toUserId: 'u-owner',
  reviewType: 'owner' as const, rating: 5, comment: '  Super  ',
};

describe('useCreateUserReview', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockInsertError = null;
    insertSpy.mockClear();
  });
  afterEach(() => queryClient.clear());

  it('отправляет отзыв и подчищает комментарий', async () => {
    const { result } = renderHook(() => useCreateUserReview(), { wrapper });

    await act(async () => { await result.current.mutateAsync(params); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(insertSpy).toHaveBeenCalledWith([expect.objectContaining({
      booking_id: 'b1', to_user_id: 'u-owner', review_type: 'owner',
      rating: 5, comment: 'Super',
    })]);
  });

  it('пустой комментарий уходит как NULL, а не как пустая строка', async () => {
    const { result } = renderHook(() => useCreateUserReview(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ...params, comment: '   ' });
    });

    expect(insertSpy).toHaveBeenCalledWith([expect.objectContaining({ comment: null })]);
  });

  it('оценка вне 1..5 не доходит до базы', async () => {
    const { result } = renderHook(() => useCreateUserReview(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ...params, rating: 0 }).catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('повтор объясняется по-человечески, а не кодом 23505', async () => {
    mockInsertError = { code: '23505', message: 'duplicate key value' };
    const { result } = renderHook(() => useCreateUserReview(), { wrapper });

    await act(async () => { await result.current.mutateAsync(params).catch(() => {}); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Vous avez déjà laissé cet avis');
  });
});
