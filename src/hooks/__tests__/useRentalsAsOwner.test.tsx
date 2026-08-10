// src/hooks/__tests__/useRentalsAsOwner.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRentalsAsOwner } from '../useRentalsAsOwner';
// import { supabase } from '../../lib/supabase'; // Import the actual instance to mock - not needed if we mock the whole export

// Hoist mock data and response config to module level
const { mockRentals, mockError } = vi.hoisted(() => ({
  mockRentals: [
    { id: 'rental-1', item_id: 'item-1', renter_id: 'user-2', start_date: '2023-10-01', end_date: '2023-10-05', status: 'pending', item: { title: 'Drill' } },
  ],
  mockError: new Error('Failed to fetch'),
}));

// Global variable to control mock response
let mockResponseData: any = null;
let mockResponseError: any = null;

// Mock the supabase module at the top level
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: mockResponseData, error: mockResponseError })),
      })),
    })),
  },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useRentalsAsOwner', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Reset mock response before each test
    mockResponseData = null;
    mockResponseError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should fetch rentals as owner successfully', async () => {
    // Configure mock response for success
    mockResponseData = mockRentals;
    mockResponseError = null;

    const { result } = renderHook(() => useRentalsAsOwner('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRentals);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockResponseData = null;
    mockResponseError = mockError;

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