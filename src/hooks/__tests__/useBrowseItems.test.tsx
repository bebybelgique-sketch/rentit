// src/hooks/__tests__/useBrowseItems.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, hashKey } from '@tanstack/react-query';
import { useBrowseItems, type BrowseFilters } from '../useBrowseItems';
import { itemKeys } from '../../lib/queryKeys';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

const rows = [
  {
    id: 'item-1',
    title: 'Perceuse',
    category: 'power_tools',
    condition: 'good',
    price_per_day: 12,
    deposit: 30,
    photos: ['https://example.com/drill.jpg'],
    lat: 50.71,
    lng: 4.61,
    address: 'Wavre',
    owner_id: 'owner-1',
    owner_full_name: 'Marie',
    owner_rating: 4.5,
    owner_is_pro: false,
    distance_m: 800,
  },
];

const base: BrowseFilters = {
  search: '',
  category: '',
  place: '',
  startDate: '',
  endDate: '',
  nearby: false,
  radiusKm: 10,
  lat: null,
  lng: null,
};

let queryClient: QueryClient;

const makeWrapper = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Ключ, который объявил хук, — из кэша, а не из справочника на веру. */
const declaredKey = () => {
  const queries = queryClient.getQueryCache().getAll();
  expect(queries).toHaveLength(1);
  return queries[0].queryKey;
};

describe('useBrowseItems: запрос', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('зовёт browse_items и отдаёт строки функции как есть', async () => {
    const { result } = renderHook(() => useBrowseItems(base), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.rpc.mock.calls[0][0]).toBe('browse_items');
    expect(result.current.data).toEqual(rows);
    // Никакой переупаковки в «удобный» тип: owner_rating остаётся плоской
    // колонкой функции, а photos — тем, что лежит в jsonb.
    expect(result.current.data?.[0]).not.toHaveProperty('users');
  });

  it('объявляет ключ витрины со всеми фильтрами', async () => {
    const { result } = renderHook(() => useBrowseItems(base), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(declaredKey()).toEqual(itemKeys.browse(base));
  });

  it('радиус уходит в функцию только вместе с включённой близостью и точкой', async () => {
    const { result } = renderHook(
      () => useBrowseItems({ ...base, nearby: true, radiusKm: 25, lat: 50.71, lng: 4.61 }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.rpc).toHaveBeenCalledWith('browse_items', expect.objectContaining({
      p_lat: 50.71,
      p_lng: 4.61,
      p_radius_km: 25,
    }));
  });

  it('без близости точка передаётся (для расстояния на карточке), а радиус — нет', async () => {
    const { result } = renderHook(
      () => useBrowseItems({ ...base, nearby: false, radiusKm: 10, lat: 50.71, lng: 4.61 }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const args = mocks.rpc.mock.calls[0][1];
    expect(args).toMatchObject({ p_lat: 50.71, p_lng: 4.61 });
    expect(args.p_radius_km).toBeUndefined();
  });

  it('половина диапазона дат и диапазон задом наперёд в функцию не уходят', async () => {
    const half = renderHook(() => useBrowseItems({ ...base, startDate: '2026-09-10' }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(half.result.current.isSuccess).toBe(true));
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_start: undefined, p_end: undefined });

    mocks.rpc.mockClear();
    const backwards = renderHook(
      () => useBrowseItems({ ...base, startDate: '2026-09-12', endDate: '2026-09-10' }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(backwards.result.current.isSuccess).toBe(true));
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_start: undefined, p_end: undefined });
  });

  it('мусор в цене не уезжает в базу: NaN отфильтровал бы витрину в ноль', async () => {
    const { result } = renderHook(() => useBrowseItems({ ...base, maxPrice: Number('12e') }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.rpc.mock.calls[0][1].p_max_price).toBeUndefined();
  });

  it('текст и место уходят обрезанными, а пустые — не уходят вовсе', async () => {
    const { result } = renderHook(() => useBrowseItems({ ...base, search: '  perceuse ', place: '  ' }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_search: 'perceuse', p_place: undefined });
  });

  it('отказ базы — это отказ запроса, а не пустая витрина', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'function browse_items not found' } });

    const { result } = renderHook(() => useBrowseItems(base), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});

describe('useBrowseItems: ключ меняется вместе с фильтром', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // Ключ, который не знает о фильтре, отдаёт вчерашнюю выдачу после его
  // изменения — и выглядит это как «фильтр не работает».
  const variations: Array<[string, BrowseFilters]> = [
    ['текст поиска', { ...base, search: 'perceuse' }],
    ['категория', { ...base, category: 'garden' }],
    ['предельная цена', { ...base, maxPrice: 25 }],
    ['место', { ...base, place: 'Wavre' }],
    ['даты', { ...base, startDate: '2026-09-10', endDate: '2026-09-12' }],
    ['близость', { ...base, nearby: true }],
    ['радиус', { ...base, nearby: true, radiusKm: 50 }],
    ['точка посетителя', { ...base, lat: 50.71, lng: 4.61 }],
  ];

  it.each(variations)('%s меняет ключ запроса', async (_name, filters) => {
    const { result } = renderHook(() => useBrowseItems(filters), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hashKey(declaredKey())).not.toBe(hashKey(itemKeys.browse(base)));
    expect(declaredKey()).toEqual(itemKeys.browse(filters));
  });

  it('прежняя выдача остаётся на экране, пока идёт запрос с новым фильтром', async () => {
    // Ради этого placeholderData: без него каждое нажатие на чип категории
    // показывало шесть скелетов — список мигал пустотой там, где человек
    // просто уточнил запрос.
    const wrapper = makeWrapper();
    const { result, rerender } = renderHook(({ filters }: { filters: BrowseFilters }) => useBrowseItems(filters), {
      wrapper,
      initialProps: { filters: base },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(rows);

    let release: (value: unknown) => void = () => undefined;
    mocks.rpc.mockReturnValue(new Promise(resolve => { release = resolve; }));
    rerender({ filters: { ...base, category: 'garden' } });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data).toEqual(rows);
    expect(result.current.isPlaceholderData).toBe(true);

    release({ data: [], error: null });
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});
