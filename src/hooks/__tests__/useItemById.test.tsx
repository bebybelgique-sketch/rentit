import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useItemById } from '../useItemById';

// Hoist mock data and response config to module level
// Заглушка отдаёт СЫРУЮ строку таблицы items (photos/address/lat/lng/available),
// а хук возвращает преобразованный Item — поэтому ожидание отдельное.
const { mockItemData, expectedItem, mockError } = vi.hoisted(() => ({
  mockItemData: {
    id: 'item-1',
    title: 'Test Item',
    description: 'Une perceuse',
    price_per_day: 10,
    photos: ['https://example.com/drill.jpg', 'https://example.com/drill-2.jpg'],
    owner_id: 'owner-1',
    address: 'Wavre, BE',
    lat: 50.71,
    lng: 4.61,
    available: true,
    created_at: '2026-01-01T00:00:00Z',
    deposit: 50,
    category: 'power_tools',
    condition: 'good',
    // Тарифов у этой вещи нет: база отдаёт NULL, и хук обязан донести
    // именно пустоту, а не ноль — ноль означал бы «неделя бесплатно».
    price_3days: null,
    price_week: 60,
    late_fee_per_day: null,
    // Прокат с двенадцатью одинаковыми стульями. Значения намеренно НЕ
    // умолчания: пропуск поля в отображении выглядел бы как «одна единица»,
    // и владелец увидел бы в форме 1 вместо 12. Ровно этот класс чинили
    // в PR #19.
    quantity: 12,
    buffer_days: 1,
    min_notice_days: 2,
    // Владелец доставляет за 15 € до 10 км. Значения не умолчания: потеря
    // их в мапперe означала бы, что форма редактирования покажет снятую
    // галку поверх включённой услуги — тот же класс, что у количества.
    delivery_fee: 15,
    delivery_radius_km: 10,
  },
  expectedItem: {
    id: 'item-1',
    title: 'Test Item',
    description: 'Une perceuse',
    price_per_day: 10,
    owner_id: 'owner-1',
    address: 'Wavre, BE',
    latitude: 50.71,
    longitude: 4.61,
    is_available: true,
    created_at: '2026-01-01T00:00:00Z',
    // Ниже — поля, которых хук не переносил: форма редактирования читает
    // именно их и подставляла пустые значения поверх заполненных.
    deposit: 50,
    category: 'power_tools',
    condition: 'good',
    photos: ['https://example.com/drill.jpg', 'https://example.com/drill-2.jpg'],
    price_3days: null,
    price_week: 60,
    late_fee_per_day: null,
    quantity: 12,
    buffer_days: 1,
    min_notice_days: 2,
    delivery_fee: 15,
    delivery_radius_km: 10,
  },
  mockError: new Error('Fetch item failed'),
}));

// Global variable to control mock response
let mockResponseData: any = null;
let mockResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.select
vi.mock('../../lib/supabase', () => {
  const chain: any = {};
  chain.select = vi.fn((columns) => {
    if (columns === '*') {
      return chain;
    }
    // If select is called with specific columns, it still returns the chain
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: mockResponseData, error: mockResponseError }));

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

describe('useItemById', () => {
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

  it('should fetch item by id successfully', async () => {
    // Configure mock response for success
    mockResponseData = mockItemData;
    mockResponseError = null;

    const { result } = renderHook(() => useItemById('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(expectedItem);
  });

  it('should handle fetch error', async () => {
    // Configure mock response for error
    mockResponseData = null;
    mockResponseError = mockError;

    const { result } = renderHook(() => useItemById('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});