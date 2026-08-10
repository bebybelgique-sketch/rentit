// src/hooks/mutations/__tests__/useCreateItem.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateItem } from '../useCreateItem';

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useCreateItem', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should create an item successfully', async () => {
    const mockItemData = { id: 'item-1', title: 'New Drill', owner_id: 'user-1', price_per_day: 20, image_url: 'https://example.com/drill.jpg', created_at: '2023-01-01T00:00:00Z' };

    // Мокаем useUploadImage, чтобы он возвращал фиксированный URL
    vi.mock('../../../hooks/useUploadImage', () => ({
      useUploadImage: () => [vi.fn(() => Promise.resolve('https://example.com/drill.jpg')), false, null],
    }));

    vi.mock('../../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockItemData, error: null })),
            })),
          })),
        })),
      },
    }));

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

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(mockItemData);
  });

  it('should handle error on create item failure', async () => {
    const mockError = new Error('Insert failed');

    vi.mock('../../../hooks/useUploadImage', () => ({
      useUploadImage: () => [vi.fn(() => Promise.resolve('https://example.com/drill.jpg')), false, null],
    }));

    vi.mock('../../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: mockError })),
            })),
          })),
        })),
      },
    }));

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

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });
});