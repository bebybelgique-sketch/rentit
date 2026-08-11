import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBookingMessages } from '../useBookingMessages';

let mockRows: any = [];
let mockError: any = null;

vi.mock('../../lib/supabase', () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: mockRows, error: mockError })),
  };
  return { supabase: { from: vi.fn(() => builder) } };
});

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useBookingMessages', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRows = [];
    mockError = null;
  });
  afterEach(() => queryClient.clear());

  it('не ходит в базу без брони', async () => {
    const { result } = renderHook(() => useBookingMessages(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('подставляет имя отправителя из связанного профиля', async () => {
    mockRows = [{
      id: 'm1', booking_id: 'b1', sender_id: 'u1', body: 'Bonjour',
      created_at: '2026-08-11T10:00:00Z', users: { full_name: 'Marie Dupont' },
    }];

    const { result } = renderHook(() => useBookingMessages('b1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].senderName).toBe('Marie Dupont');
    expect(result.current.data?.[0].body).toBe('Bonjour');
  });

  it('не показывает пустоту вместо имени, когда профиль без имени', async () => {
    mockRows = [{
      id: 'm1', booking_id: 'b1', sender_id: 'u1', body: 'Salut',
      created_at: '2026-08-11T10:00:00Z', users: { full_name: null },
    }];

    const { result } = renderHook(() => useBookingMessages('b1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].senderName).toBe('Utilisateur');
  });

  it('пробрасывает ошибку запроса', async () => {
    mockError = new Error('permission denied');

    const { result } = renderHook(() => useBookingMessages('b1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
