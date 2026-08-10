// src/hooks/mutations/__tests__/useCreateRental.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateRental } from '../useCreateRental';
// import { supabase } from '../../../lib/supabase'; // Import to mock - not needed if we mock the whole export

// Hoist mock data and response config to module level
const { mockRentalResponse, mockError } = vi.hoisted(() => ({
  mockRentalResponse: { booking_id: 'booking-123' }, // New expected return type
  mockError: new Error('Request failed'),
}));

// Global variable to control mock response
let mockInvokeResponseData: any = null;
let mockInvokeResponseError: any = null;

// Mock the supabase module at the top level, focusing on functions.invoke
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async (fnName, options) => {
        if (fnName === 'request-rental') {
          return Promise.resolve({ data: mockInvokeResponseData, error: mockInvokeResponseError });
        }
        // Fallback for other functions if needed
        return Promise.resolve({ data: null, error: new Error(`Unknown function: ${fnName}`) });
      }),
    },
  },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useCreateRental', () => {
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

  it('should create a rental successfully', async () => {
    // Configure mock response for success
    mockInvokeResponseData = mockRentalResponse;
    mockInvokeResponseError = null;

    const { result } = renderHook(() => useCreateRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        item_id: 'item-1',
        start_date: '2023-10-01',
        end_date: '2023-10-05',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRentalResponse); // Expect { booking_id: ... }
  });

  it('should handle error on create rental failure', async () => {
    // Configure mock response for error
    mockInvokeResponseData = null;
    mockInvokeResponseError = mockError;

    const { result } = renderHook(() => useCreateRental(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          item_id: 'item-1',
          start_date: '2023-10-01',
          end_date: '2023-10-05',
        });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});