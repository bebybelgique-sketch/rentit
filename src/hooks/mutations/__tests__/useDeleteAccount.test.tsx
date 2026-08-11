import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteAccount } from '../useDeleteAccount';
import { supabase } from '../../../lib/supabase';

// Hoist mock data and response config to module level
const { mockSuccessResponse, mockError } = vi.hoisted(() => ({
  mockSuccessResponse: {}, // As per instruction: data: {}
  mockError: new Error('Delete account failed'),
}));

// Global variable to control mock response
let mockInvokeResponseData: any = null;
let mockInvokeResponseError: any = null;
let mockSignOutResolved = true; // Default to success

// Mock the supabase module at the top level, focusing on functions.invoke and auth.signOut
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async (fnName: string) => {
        if (fnName === 'delete-account') {
          return Promise.resolve({ data: mockInvokeResponseData, error: mockInvokeResponseError });
        }
        // Fallback for other functions if needed
        return Promise.resolve({ data: null, error: new Error(`Unknown function: ${fnName}`) });
      }),
    },
    auth: {
      signOut: vi.fn(async () => {
        if (mockSignOutResolved) {
          return Promise.resolve({ error: null });
        } else {
          return Promise.resolve({ error: new Error('Sign out failed') });
        }
      }),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useDeleteAccount', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Reset mock response before each test
    mockInvokeResponseData = null;
    mockInvokeResponseError = null;
    mockSignOutResolved = true; // Assume signOut succeeds by default for the main success test
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should delete account successfully', async () => {
    // Configure mock response for success
    mockInvokeResponseData = mockSuccessResponse;
    mockInvokeResponseError = null;
    mockSignOutResolved = true;

    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Note: The result.data might be from the function invoke or undefined depending on the hook logic.
    // If the hook returns the result of signOut(), it would be { error: null }.
    // If it returns the result of invoke(), it would be mockSuccessResponse ({}).
    // Assuming the hook returns the result of the invoke for the primary action.
    // Хук ничего не возвращает: он вызывает delete-account, затем signOut.
    expect(result.current.data).toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('should handle error on delete account failure', async () => {
    // Configure mock response for error during invoke
    mockInvokeResponseData = null;
    mockInvokeResponseError = mockError;
    mockSignOutResolved = true; // signOut itself doesn't fail in this test

    const { result } = renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});