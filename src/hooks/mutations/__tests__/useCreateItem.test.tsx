// src/hooks/mutations/__tests__/useCreateItem.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateItem } from '../useCreateItem';
import { useUploadImage } from '../../../hooks/useUploadImage'; // Import to mock
// import { supabase } from '../../../lib/supabase'; // Import to mock - not needed if we mock the whole export

// Hoist mock data and response config to module level
const { mockItemData, mockError, mockImageUrl } = vi.hoisted(() => ({
  mockItemData: { id: 'item-1', title: 'New Drill', owner_id: 'user-1', price_per_day: 20, image_url: 'https://example.com/drill.jpg', created_at: '2023-01-01T00:00:00Z' },
  mockError: new Error('Insert failed'),
  mockImageUrl: 'https://example.com/drill.jpg',
}));

// Global variables to control mocks
let mockSupabaseResponseData: any = null;
let mockSupabaseResponseError: any = null;
let mockUploadImageUrl: string | null = null;
let mockUploadImageLoading = false;
let mockUploadImageError: any = null;

// Mock supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockSupabaseResponseData, error: mockSupabaseResponseError })),
        })),
      })),
    })),
  },
}));

// Mock useUploadImage
vi.mock('../../../hooks/useUploadImage', () => ({
  useUploadImage: () => [vi.fn(() => Promise.resolve(mockUploadImageUrl)), mockUploadImageLoading, mockUploadImageError],
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useCreateItem', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Reset mock responses before each test
    mockSupabaseResponseData = null;
    mockSupabaseResponseError = null;
    mockUploadImageUrl = 'https://example.com/drill.jpg';
    mockUploadImageLoading = false;
    mockUploadImageError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should create an item successfully', async () => {
    // Configure mock response for success
    mockSupabaseResponseData = mockItemData;
    mockSupabaseResponseError = null;

    const { result } = renderHook(() => useCreateItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'New Drill',
        description: 'A powerful drill',
        price_per_day: 20,
        deposit: 50,
        category: 'power_tools',
        condition: 'good',
        address: 'Brussels, BE',
        lat: 50.8503,
        lng: 4.3517,
        available: true,
        imageUrl: 'https://example.com/drill.jpg',
        userId: 'user-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItemData);
  });

  it('should handle error on create item failure', async () => {
    // Configure mock response for error
    mockSupabaseResponseData = null;
    mockSupabaseResponseError = mockError;

    const { result } = renderHook(() => useCreateItem(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          title: 'New Drill',
          description: 'A powerful drill',
          price_per_day: 20,
          deposit: 50,
          category: 'power_tools',
          condition: 'good',
          address: 'Brussels, BE',
          lat: 50.8503,
          lng: 4.3517,
          available: true,
          imageUrl: 'https://example.com/drill.jpg',
          userId: 'user-1',
        });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});