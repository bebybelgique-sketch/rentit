// src/hooks/__tests__/useItems.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useItems } from '../useItems';

// Hoist mock data and response config to module level
const { mockRawItems, mockError } = vi.hoisted(() => ({
  mockRawItems: [
    {
      id: '1',
      title: 'Test Item',
      description: 'A test item',
      price_per_day: 10,
      photos: ['url1.jpg'], // Raw data from DB
      available: true, // Raw data from DB
      owner_id: 'owner1',
      created_at: '2023-01-01',
      deposit: 50,
      condition: 'good',
      lat: 50.85,
      lng: 4.35,
      address: 'Test Address',
    },
  ],
  mockError: new Error('Failed to fetch'),
}));

// Global variable to control mock response
let mockResponseData: any = null;
let mockResponseError: any = null;

// Mock the supabase module at the top level using the hoisted data
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: mockResponseData, error: mockResponseError })),
    })),
  },
}));

// Создаем новый QueryClient для каждого теста
let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useItems', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }, // Отключаем повторные попытки для тестов
    });
    // Reset mock response before each test
    mockResponseData = null;
    mockResponseError = null;
  });

  afterEach(() => {
    queryClient.clear(); // Очищаем кеш между тестами
  });

  it('should fetch items successfully', async () => {
    // Configure mock response for success
    mockResponseData = mockRawItems;
    mockResponseError = null;

    // Отдельного «ожидаемого» списка нет: хук возвращает строки как есть.
    // Прежде здесь дублировалась логика маппера — тест повторял код хука и
    // потому не мог поймать в нём ошибку, только его переписывание.
    const { result } = renderHook(() => useItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockRawItems);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockResponseData = null;
    mockResponseError = mockError;

    const { result } = renderHook(() => useItems(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});