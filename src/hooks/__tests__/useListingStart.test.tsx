import { describe, it, expect, beforeEach, vi } from 'vitest';

// Два запроса, и отказ любого не должен ни бросать (react-query ушёл бы в
// повторы, а человек ждал бы перед пустым экраном), ни выдумывать ответ.
type Result = { data: unknown; error: unknown };
let users: Result;
let items: Result;
const itemFilters: Array<[string, ...unknown[]]> = [];

vi.mock('../../lib/supabase', () => {
  const chain = (result: () => Result, log?: typeof itemFilters) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'order', 'limit']) {
      q[m] = (...args: unknown[]) => { log?.push([m, ...args]); return q; };
    }
    q.maybeSingle = () => Promise.resolve(result());
    return q;
  };
  return {
    supabase: {
      from: (table: string) => table === 'users' ? chain(() => users) : chain(() => items, itemFilters),
    },
  };
});

import { fetchListingStart } from '../useListingStart';

describe('fetchListingStart', () => {
  beforeEach(() => {
    users = { data: { avatar_url: null }, error: null };
    items = { data: null, error: null };
    itemFilters.length = 0;
  });

  it('нет фото — просьба нужна; есть — нет', async () => {
    expect((await fetchListingStart('u-1')).needsPhoto).toBe(true);
    users = { data: { avatar_url: 'https://x/a.jpg' }, error: null };
    expect((await fetchListingStart('u-1')).needsPhoto).toBe(false);
  });

  it('отказ проверки фото — без просьбы, а не с ней', async () => {
    users = { data: null, error: { message: 'boom' } };
    expect((await fetchListingStart('u-1')).needsPhoto).toBe(false);
  });

  it('место берётся у СВОЕГО последнего объявления С позицией', async () => {
    items = { data: { lat: 50.7, lng: 4.6, address: 'Walhain' }, error: null };
    expect((await fetchListingStart('u-1')).lastPlace).toEqual({ lat: 50.7, lng: 4.6, address: 'Walhain' });
    expect(itemFilters).toContainEqual(['eq', 'owner_id', 'u-1']);
    expect(itemFilters).toContainEqual(['not', 'lat', 'is', null]);
    expect(itemFilters).toContainEqual(['not', 'lng', 'is', null]);
    expect(itemFilters).toContainEqual(['order', 'created_at', { ascending: false }]);
  });

  it('отказ запроса места — форма с чистого листа, не падение', async () => {
    items = { data: null, error: { message: 'boom' } };
    await expect(fetchListingStart('u-1')).resolves.toMatchObject({ lastPlace: null });
  });
});
