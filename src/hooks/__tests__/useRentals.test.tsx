import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRentals } from '../useRentals';

// Hoist mock data and response config to module level
const { mockRentalsData, mockError } = vi.hoisted(() => ({
  mockRentalsData: [
    { id: 'rental-1', item_id: 'item-1', start_date: '2023-10-01', end_date: '2023-10-05', status: 'confirmed' },
  ],
  mockError: new Error('Fetch rentals failed'),
}));

// Global variable to control mock response
let mockResponseData: any = null;
let mockResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.select
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: mockResponseData, error: mockResponseError })),
        })),
      })),
    })),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useRentals', () => {
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

  it('should fetch rentals successfully', async () => {
    // Configure mock response for success
    mockResponseData = mockRentalsData;
    mockResponseError = null;

    const { result } = renderHook(() => useRentals('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRentalsData);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockResponseData = null;
    mockResponseError = mockError;

    const { result } = renderHook(() => useRentals('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});