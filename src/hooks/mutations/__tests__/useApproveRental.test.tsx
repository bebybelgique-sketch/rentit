import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { bookingKeys, itemKeys } from '../../../lib/queryKeys';
import { useApproveRental } from '../useApproveRental';

// Hoist mock data and response config to module level
const { mockSuccessResponse, mockError } = vi.hoisted(() => ({
  mockSuccessResponse: { ok: true },
  mockError: new Error('Approve failed'),
}));

// Global variable to control mock response
let mockInvokeResponseData: any = null;
let mockInvokeResponseError: any = null;

// Mock the supabase module at the top level, focusing on functions.invoke
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async (fnName: string) => {
        if (fnName === 'respond-to-request') {
          return Promise.resolve({ data: mockInvokeResponseData, error: mockInvokeResponseError });
        }
        // Fallback for other functions if needed
        return Promise.resolve({ data: null, error: new Error(`Unknown function: ${fnName}`) });
      }),
    },
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useApproveRental', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Reset mock response before each test
    mockInvokeResponseData = null;
    mockInvokeResponseError = null;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should approve a rental successfully', async () => {
    // Configure mock response for success
    mockInvokeResponseData = mockSuccessResponse;
    mockInvokeResponseError = null;

    const { result } = renderHook(() => useApproveRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  // Успех — когда экран уже показывает новое. До 03.10 перечитывание шло
  // в фоне: тост «demande acceptée» висел над карточкой, которая ещё
  // показывала заявку с живыми кнопками, и второе нажатие получало 409.
  it('мутация завершается, когда открытый список броней уже перечитан', async () => {
    mockInvokeResponseData = mockSuccessResponse;
    let version = 0;
    const { result } = renderHook(() => ({
      list: useQuery({
        queryKey: bookingKeys.asOwner('owner-1'),
        queryFn: () => new Promise<string>((resolve) => { const v = ++version; setTimeout(() => resolve(`v${v}`), 20); }),
      }),
      approve: useApproveRental(),
    }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toBe('v1'));

    await act(async () => {
      await result.current.approve.mutateAsync({ bookingId: 'booking-1' });
      // Прямо в момент успеха список уже новый, а не «скоро будет».
      expect(queryClient.getQueryData(bookingKeys.asOwner('owner-1'))).toBe('v2');
    });
  });

  // Отказ функции приходит НЕ в `data`, а телом внутри error.context —
  // именно поэтому прежняя проверка `data?.error || error.message`
  // показывала человеку «Edge Function returned a non-2xx status code»
  // вместо причины. Хук обязан достать код.
  it('достаёт код отказа из тела ответа', async () => {
    mockInvokeResponseData = null;
    mockInvokeResponseError = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response(JSON.stringify({ error: 'booking_changed' }), { status: 409 }),
    });

    const { result } = renderHook(() => useApproveRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('booking_changed');
  });

  it('без тела отдаёт общий код, а не фразу supabase-js', async () => {
    // Сетевой сбой: тела нет вовсе. Показывать служебную фразу библиотеки
    // нельзя — по коду 'internal_error' словарь даст человеческий текст.
    mockInvokeResponseData = null;
    mockInvokeResponseError = mockError;

    const { result } = renderHook(() => useApproveRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('internal_error');
  });

  // Ключи инвалидации — суть правки 06.09. До неё хук бил по двум разным
  // именам списков броней и по мёртвому ключу занятых дат (такой запрос не
  // объявлял никто), а список «Моих вещей» — ['items', 'asOwner', userId] —
  // не трогал вовсе: владелец, одобривший заявку из /my-rentals, видел её в
  // «Моих вещах» как новую, пока не обновлял страницу руками.
  it('после успеха инвалидирует брони и вещи — ключи из общего справочника', async () => {
    mockInvokeResponseData = mockSuccessResponse;
    mockInvokeResponseError = null;

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useApproveRental(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1' });
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingKeys.all }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: itemKeys.all });
    // Оба префикса — из src/lib/queryKeys; набор один на все мутации броней.
    // Ровно два вызова: ни мёртвого ключа занятых дат, ни прежних двух имён
    // списков броней здесь больше нет — оба взгляда ловит один префикс.
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
