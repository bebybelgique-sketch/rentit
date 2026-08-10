import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserBookingForItem } from '../useUserBookingForItem';

// Хук включается только когда есть залогиненный пользователь (enabled в
// useQuery). Без этого мока запрос вообще не стартует и isSuccess не наступит.
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
}));

// Hoist mock data and response config to module level
const { mockBookingData, mockError } = vi.hoisted(() => ({
  mockBookingData: { id: 'booking-1', item_id: 'item-1', renter_id: 'user-1', status: 'confirmed' },
  mockError: new Error('Fetch user booking failed'),
}));

// Global variable to control mock response
let mockResponseData: any = null;
let mockResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.select
vi.mock('../../lib/supabase', () => {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: mockResponseData, error: mockResponseError }));

  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
  };
});

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useUserBookingForItem', () => {
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

  it('should fetch user booking for item successfully', async () => {
    // Configure mock response for success
    mockResponseData = mockBookingData;
    mockResponseError = null;

    const { result } = renderHook(() => useUserBookingForItem('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockBookingData);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockResponseData = null;
    mockResponseError = mockError;

    const { result } = renderHook(() => useUserBookingForItem('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});