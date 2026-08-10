// src/hooks/__tests__/useItems.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useItems } from '../useItems';

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
  });

  afterEach(() => {
    queryClient.clear(); // Очищаем кеш между тестами
  });

  it('should fetch items successfully', async () => {
    // Предположим, что supabase мокирован должным образом в вашей тестовой среде
    // или вы можете использовать msw (Mock Service Worker) для мокирования API-вызовов
    // Здесь показан пример с мокированием через vi.mock
    const mockItems = [
      { id: '1', title: 'Test Item', description: 'A test item', price_per_day: 10, image_url: '', owner_id: 'owner1', is_available: true, created_at: '2023-01-01' },
    ];

    vi.mock('../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: mockItems, error: null })),
        })),
      },
    }));

    const { result } = renderHook(() => useItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockItems);
  });

  it('should handle fetch error', async () => {
    const mockError = new Error('Failed to fetch');

    vi.mock('../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: null, error: mockError })),
        })),
      },
    }));

    const { result } = renderHook(() => useItems(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});