import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateProfile } from '../useUpdateProfile';

// Hoist mock data and response config to module level
const { mockUserData, mockError } = vi.hoisted(() => ({
  mockUserData: { id: 'user-1', full_name: 'Updated Name', avatar_url: 'new-url.jpg' },
  mockError: new Error('Update failed'),
}));

// Global variable to control mock response
let mockUpdateResponseData: any = null;
let mockUpdateResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.update
vi.mock('../../../lib/supabase', () => {
  const chain: any = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: mockUpdateResponseData, error: mockUpdateResponseError }));

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

describe('useUpdateProfile', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Reset mock response before each test
    mockUpdateResponseData = null;
    mockUpdateResponseError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should update profile successfully', async () => {
    // Configure mock response for success
    mockUpdateResponseData = mockUserData;
    mockUpdateResponseError = null;

    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ userId: 'user-1', updates: { full_name: 'Updated Name' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUserData);
  });

  it('should handle error on update profile failure', async () => {
    // Configure mock response for error
    mockUpdateResponseData = null;
    mockUpdateResponseError = mockError;

    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ userId: 'user-1', updates: { full_name: 'Updated Name' } });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});