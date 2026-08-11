import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRejectRental } from '../useRejectRental';

// Hoist mock data and response config to module level
const { mockSuccessResponse, mockError } = vi.hoisted(() => ({
  mockSuccessResponse: { ok: true },
  mockError: new Error('Reject failed'),
}));

// Global variable to control mock response
let mockInvokeResponseData: any = null;
let mockInvokeResponseError: any = null;

// Mock the supabase module at the top level, focusing on functions.invoke
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async (fnName: string) => {
        if (fnName === 'respond-to-request') {
          return Promise.resolve({
            data: mockInvokeResponseData,
            error: mockInvokeResponseError,
          });
        }
        // Fallback for other functions if needed
        return Promise.resolve({
          data: null,
          error: new Error(`Unknown function: ${fnName}`),
        });
      }),
    },
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

describe('useRejectRental', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Reset mock response before each test
    mockInvokeResponseData = null;
    mockInvokeResponseError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should reject a rental successfully', async () => {
    // Configure mock response for success
    mockInvokeResponseData = mockSuccessResponse;
    mockInvokeResponseError = null;

    const { result } = renderHook(() => useRejectRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('should handle error on reject rental failure', async () => {
    // Configure mock response for error
    mockInvokeResponseData = null;
    mockInvokeResponseError = mockError;

    const { result } = renderHook(() => useRejectRental(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ bookingId: 'booking-1' });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});