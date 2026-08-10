// src/hooks/mutations/__tests__/useDeleteItem.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteItem } from '../useDeleteItem';
// import { supabase } from '../../../lib/supabase'; // Import to mock - not needed if we mock the whole export

// Hoist mock data and response config to module level
const { mockError } = vi.hoisted(() => ({
  mockError: new Error('Delete failed'),
}));

// Global variable to control mock response
let mockDeleteResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.delete
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        match: vi.fn(() => Promise.resolve({ error: mockDeleteResponseError })),
      })),
    })),
  },
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
    // Reset mock response before each test
    mockDeleteResponseError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should delete an item successfully', async () => {
    // Configure mock response for success (no error)
    mockDeleteResponseError = null;

    const { result } = renderHook(() => useDeleteItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'item-1', userId: 'user-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should handle error on delete item failure', async () => {
    // Configure mock response for error
    mockDeleteResponseError = mockError;

    const { result } = renderHook(() => useDeleteItem(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ itemId: 'item-1', userId: 'user-1' });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});