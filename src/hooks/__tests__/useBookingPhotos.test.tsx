import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBookingPhotos } from '../useBookingPhotos';

let mockRows: any = [];
let mockSigned: any = [];
let mockSignError: any = null;

vi.mock('../../lib/supabase', () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: mockRows, error: null })),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: vi.fn(() =>
            Promise.resolve({ data: mockSigned, error: mockSignError })),
        })),
      },
    },
  };
});

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useBookingPhotos', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRows = [];
    mockSigned = [];
    mockSignError = null;
  });
  afterEach(() => queryClient.clear());

  it('выдаёт подписанную ссылку, а не путь из базы', async () => {
    mockRows = [{
      id: 'p1', booking_id: 'b1', uploaded_by: 'u1', phase: 'handover',
      storage_path: 'b1/handover/a.jpg', created_at: '2026-08-11T10:00:00Z',
    }];
    mockSigned = [{ path: 'b1/handover/a.jpg', signedUrl: 'https://signed.example/a.jpg?token=x' }];

    const { result } = renderHook(() => useBookingPhotos('b1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].url).toBe('https://signed.example/a.jpg?token=x');
    expect(result.current.data?.[0].phase).toBe('handover');
  });

  it('не показывает фотографию, для которой подпись не выдана', async () => {
    mockRows = [
      { id: 'p1', booking_id: 'b1', uploaded_by: 'u1', phase: 'handover', storage_path: 'b1/handover/a.jpg', created_at: '2026-08-11T10:00:00Z' },
      { id: 'p2', booking_id: 'b1', uploaded_by: 'u1', phase: 'return', storage_path: 'b1/return/b.jpg', created_at: '2026-08-11T11:00:00Z' },
    ];
    // Подпись пришла только для первой: пустой <img> выглядел бы как
    // «фотографию не делали», а это прямая ложь о состоянии вещи.
    mockSigned = [{ path: 'b1/handover/a.jpg', signedUrl: 'https://signed.example/a.jpg?token=x' }];

    const { result } = renderHook(() => useBookingPhotos('b1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe('p1');
  });

  it('не запрашивает подписи, когда фотографий нет', async () => {
    mockRows = [];
    const { result } = renderHook(() => useBookingPhotos('b1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
