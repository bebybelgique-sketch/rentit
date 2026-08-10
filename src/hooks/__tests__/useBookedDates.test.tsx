import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBookedDates } from '../useBookedDates';

// Hoist mock data and response config to module level
const { mockDatesData, mockError } = vi.hoisted(() => ({
  mockDatesData: [{ date: '2023-10-01' }, { date: '2023-10-02' }],
  mockError: new Error('Fetch booked dates failed'),
}));

// Global variable to control mock response
let mockRpcResponseData: any = null;
let mockRpcResponseError: any = null;

// Mock the supabase module at the top level, focusing on rpc
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: mockRpcResponseData, error: mockRpcResponseError })),
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

describe('useBookedDates', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Reset mock response before each test
    mockRpcResponseData = null;
    mockRpcResponseError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should fetch booked dates successfully', async () => {
    // Configure mock response for success
    mockRpcResponseData = mockDatesData;
    mockRpcResponseError = null;

    const { result } = renderHook(() => useBookedDates('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockDatesData);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockRpcResponseData = null;
    mockRpcResponseError = mockError;

    const { result } = renderHook(() => useBookedDates('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});