import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateItem } from '../useUpdateItem';
import { supabase } from '../../../lib/supabase';

// Hoist mock data and response config to module level
// База отдаёт сырую строку items, а хук возвращает преобразованный Item —
// поэтому ожидание описано отдельно.
const { mockItemData, expectedItem, mockError } = vi.hoisted(() => ({
  mockItemData: {
    id: 'item-1',
    title: 'Updated Title',
    description: 'Une perceuse',
    price_per_day: 30,
    photos: ['https://example.com/drill.jpg'],
    owner_id: 'owner-1',
    address: 'Wavre, BE',
    lat: 50.71,
    lng: 4.61,
    available: true,
    created_at: '2026-01-01T00:00:00Z',
    // Эти поля база отдаёт, а хук их терял. Результат кладётся в кэш через
    // setQueryData и ЗАМЕЩАЕТ полный объект — форма, открытая сразу после
    // сохранения, показывала пустую категорию поверх сохранённой.
    deposit: 50,
    category: 'power_tools',
    condition: 'good',
    price_3days: null,
    price_week: 60,
    late_fee_per_day: 10,
    // Тот же класс, что у полей выше: результат ЗАМЕЩАЕТ объект в кэше, и
    // потерянное здесь количество показалось бы в форме как «1 единица»
    // поверх только что сохранённых двенадцати.
    quantity: 12,
    buffer_days: 1,
    min_notice_days: 2,
    // Результат ЗАМЕЩАЕТ объект в кэше: потеряв доставку здесь, форма сразу
    // после сохранения показала бы «не доставляю» поверх только что
    // включённой услуги.
    delivery_fee: 15,
    delivery_radius_km: 10,
  },
  expectedItem: {
    id: 'item-1',
    title: 'Updated Title',
    description: 'Une perceuse',
    price_per_day: 30,
    owner_id: 'owner-1',
    address: 'Wavre, BE',
    latitude: 50.71,
    longitude: 4.61,
    is_available: true,
    created_at: '2026-01-01T00:00:00Z',
    deposit: 50,
    category: 'power_tools',
    condition: 'good',
    photos: ['https://example.com/drill.jpg'],
    price_3days: null,
    price_week: 60,
    late_fee_per_day: 10,
    quantity: 12,
    buffer_days: 1,
    min_notice_days: 2,
    delivery_fee: 15,
    delivery_radius_km: 10,
  },
  mockError: new Error('Update item failed'),
}));

// Global variable to control mock response
let mockUpdateResponseData: any = null;
let mockUpdateResponseError: any = null;

// Mock the supabase module at the top level, focusing on from.update
vi.mock('../../../lib/supabase', () => {
  const chain: any = {};
  chain.update = vi.fn(() => chain);
  chain.match = vi.fn(() => chain);
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

describe('useUpdateItem', () => {
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

  it('should update item successfully', async () => {
    // Configure mock response for success
    mockUpdateResponseData = mockItemData;
    mockUpdateResponseError = null;

    const { result } = renderHook(() => useUpdateItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', userId: 'owner-1', updates: { title: 'Updated Title' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(expectedItem);
  });

  it('should handle error on update item failure', async () => {
    // Configure mock response for error
    mockUpdateResponseData = null;
    mockUpdateResponseError = mockError;

    const { result } = renderHook(() => useUpdateItem(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'item-1', userId: 'owner-1', updates: { title: 'Updated Title' } });
      } catch (e) {
        // Ожидаем, что mutateAsync выбросит ошибку
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });

  // Колонка items.location существует, но это geography (generated always as
  // ST_SetSRID(ST_MakePoint(lng, lat))) — точка на карте, а не «Wavre, BE».
  // Пока поле приложения звалось так же, адрес и геометрия отличались только
  // тем, кто их читает. Имени location в результате быть не должно, а в
  // запросе на запись Postgres такую колонку отверг бы целиком: писать в
  // generated-колонку нельзя.
  it('в результате адрес зовётся address, а location не появляется', async () => {
    mockUpdateResponseData = mockItemData;
    mockUpdateResponseError = null;

    const { result } = renderHook(() => useUpdateItem(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'item-1', userId: 'owner-1', updates: { address: 'Namur, BE' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveProperty('address', 'Wavre, BE');
    expect(result.current.data).not.toHaveProperty('location');

    const calls = (supabase.from('items').update as unknown as Mock).mock.calls;
    const sent = calls[calls.length - 1][0];
    expect(sent).not.toHaveProperty('location');
  });
});