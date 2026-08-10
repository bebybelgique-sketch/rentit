import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useItemReviews } from '../useItemReviews';

// Hoist mock data and response config to module level
const { mockReviewsData, mockError } = vi.hoisted(() => ({
  mockReviewsData: [
    { id: 'review-1', item_id: 'item-1', rating: 5, comment: 'Great item!' },
  ],
  mockError: new Error('Fetch reviews failed'),
}));

// Global variable to control mock response
let mockResponseData: any = null;
let mockResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.select
vi.mock('../../lib/supabase', () => {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data: mockResponseData, error: mockResponseError }));

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

describe('useItemReviews', () => {
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

  it('should fetch item reviews successfully', async () => {
    // Configure mock response for success
    mockResponseData = mockReviewsData;
    mockResponseError = null;

    const { result } = renderHook(() => useItemReviews('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockReviewsData);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockResponseData = null;
    mockResponseError = mockError;

    const { result } = renderHook(() => useItemReviews('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});