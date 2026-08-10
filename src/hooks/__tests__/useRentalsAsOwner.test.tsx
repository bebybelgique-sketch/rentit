// src/hooks/__tests__/useRentalsAsOwner.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRentalsAsOwner } from '../useRentalsAsOwner';

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useRentalsAsOwner', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should fetch rentals as owner successfully', async () => {
    const mockRentals = [
      { id: 'rental-1', item_id: 'item-1', renter_id: 'user-2', start_date: '2023-10-01', end_date: '2023-10-05', status: 'pending', item: { title: 'Drill' } },
    ];

    vi.mock('../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: mockRentals, error: null })),
          })),
        })),
      },
    }));

    const { result } = renderHook(() => useRentalsAsOwner('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRentals);
  });

  it('should handle fetch error', async () => {
    const mockError = new Error('Failed to fetch');

    vi.mock('../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: mockError })),
          })),
        })),
      },
    }));

    const { result } = renderHook(() => useRentalsAsOwner('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });

  it('should not fetch if userId is not provided', () => {
    const { result } = renderHook(() => useRentalsAsOwner(undefined), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});