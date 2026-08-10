// src/hooks/mutations/__tests__/useCreateRental.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateRental } from '../useCreateRental';

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useCreateRental', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should create a rental successfully', async () => {
    const mockRentalData = { id: 'rental-1', item_id: 'item-1', renter_id: 'user-1', start_date: '2023-10-01', end_date: '2023-10-05', total_price: 100, status: 'pending' };

    vi.mock('../../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockRentalData, error: null })),
            })),
          })),
        })),
      },
    }));

    const { result } = renderHook(() => useCreateRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        item_id: 'item-1',
        start_date: '2023-10-01',
        end_date: '2023-10-05',
      });
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(mockRentalData);
  });

  it('should handle error on create rental failure', async () => {
    const mockError = new Error('Insert failed');

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

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(mockError);
  });
});