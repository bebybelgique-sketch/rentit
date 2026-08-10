// src/hooks/mutations/__tests__/useDeleteItem.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteItem } from '../useDeleteItem';

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useDeleteItem', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should delete an item successfully', async () => {
    vi.mock('../../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          delete: vi.fn(() => ({
            match: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      },
    }));

    const { result } = renderHook(() => useDeleteItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'item-1', userId: 'user-1' });
    });

    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle error on delete item failure', async () => {
    const mockError = new Error('Delete failed');

    vi.mock('../../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          delete: vi.fn(() => ({
            match: vi.fn(() => Promise.resolve({ error: mockError })),
          })),
        })),
      },
    }));

    const { result } = renderHook(() => useDeleteItem(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ itemId: 'item-1', userId: 'user-1' });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });
});