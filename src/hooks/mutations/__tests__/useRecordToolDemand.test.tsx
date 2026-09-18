import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRecordToolDemand } from '../useRecordToolDemand';

let insertArg: Record<string, unknown> | null = null;
let insertError: { message: string } | null = null;
// Всё, что вызвали на результате insert. Пусто — значит `.select()` никто не
// добавил; см. проверку ниже, почему это важно.
let chainedAfterInsert: string[] = [];

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn((arg: Record<string, unknown>) => {
        insertArg = arg;
        const result = { error: insertError };
        return new Proxy(Promise.resolve(result) as unknown as Record<string, unknown>, {
          get(target, prop) {
            if (prop === 'then' || prop === 'catch' || prop === 'finally') {
              return (Reflect.get(target, prop) as (...a: unknown[]) => unknown).bind(target);
            }
            chainedAfterInsert.push(String(prop));
            return () => Promise.resolve(result);
          },
        });
      }),
    })),
  },
}));

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useRecordToolDemand', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    insertArg = null;
    insertError = null;
    chainedAfterInsert = [];
  });

  it('пишет названный инструмент, поисковую строку и язык', async () => {
    const { result } = renderHook(() => useRecordToolDemand(), { wrapper });
    result.current.mutate({ tool: '  perforateur  ', searchedQuery: ' perfo bosch ', locale: 'fr' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(insertArg).toEqual({ tool: 'perforateur', searched_query: 'perfo bosch', locale: 'fr' });
  });

  // Расхождение между названным и набранным — само по себе сведение: оно
  // показывает, что поиск понял не то. Поэтому пишутся ОБА поля.
  it('сохраняет обе строки, даже когда они разошлись', async () => {
    const { result } = renderHook(() => useRecordToolDemand(), { wrapper });
    result.current.mutate({ tool: 'perceuse', searchedQuery: 'drill' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(insertArg).toMatchObject({ tool: 'perceuse', searched_query: 'drill' });
  });

  it('пустая поисковая строка — это NULL, а не видимость данных', async () => {
    const { result } = renderHook(() => useRecordToolDemand(), { wrapper });
    result.current.mutate({ tool: 'scie', searchedQuery: '   ' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(insertArg).toMatchObject({ searched_query: null, locale: null });
  });

  // САМОЕ ВАЖНОЕ В ЭТОМ ФАЙЛЕ. Таблица пишущая, но не читающая: у клиента
  // есть только INSERT (миграции 34 и 36), и проверено это на живой базе —
  // GET/PATCH/DELETE отвечают 42501. PostgREST не требует права на чтение
  // только при `return=minimal`, то есть пока после insert НИЧЕГО не вызвано.
  // Добавленный когда-нибудь `.select()` вернёт 42501 в проде и ничего не
  // сломает в тестах — если не проверить это здесь.
  it('после insert не вызывается ничего: select потребовал бы права на чтение', async () => {
    const { result } = renderHook(() => useRecordToolDemand(), { wrapper });
    result.current.mutate({ tool: 'ponceuse' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(chainedAfterInsert).toEqual([]);
  });

  it('отказ базы доходит до вызывающего, а не глохнет', async () => {
    insertError = { message: 'permission denied for table tool_demands' };
    const { result } = renderHook(() => useRecordToolDemand(), { wrapper });
    result.current.mutate({ tool: 'marteau' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('permission denied');
  });
});
