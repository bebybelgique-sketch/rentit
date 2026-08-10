// src/hooks/__tests__/useItems.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useItems } from '../useItems';
import { supabase } from '../../lib/supabase'; // Import the actual instance to mock

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

    // Expected processed items based on raw data transformation logic
    // Result should have fields: id, title, description, price_per_day, image_url, owner_id, location, latitude, longitude, is_available, created_at
    const expectedProcessedItems = mockRawItems.map(raw => ({
      id: raw.id,
      title: raw.title,
      description: raw.description,
      price_per_day: raw.price_per_day,
      image_url: raw.photos?.[0] || null, // Transformation logic from useItems
      owner_id: raw.owner_id,
      location: raw.address, // Transformation logic from useItems
      latitude: raw.lat, // Transformation logic from useItems
      longitude: raw.lng, // Transformation logic from useItems
      is_available: raw.available, // Transformation logic from useItems
      created_at: raw.created_at,
      // Explicitly exclude other raw fields that are transformed or not part of the final object
      // deposit, condition, photos, available, address, lat, lng are not present in the final object
    }));

    const { result } = renderHook(() => useItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(expectedProcessedItems);
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