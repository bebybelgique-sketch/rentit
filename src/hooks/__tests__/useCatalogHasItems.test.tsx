import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCatalogHasItems } from '../useCatalogHasItems';

// Ответ базы на безфильтровый счёт. Меняется в каждом тесте.
let mockCount: number | null = null;
let mockError: { message: string } | null = null;
// Сюда попадают аргументы select и eq — проверка, что считается именно то,
// что нужно экрану, а не «что-нибудь в таблице».
let selectArgs: unknown[] = [];
let eqArgs: unknown[] = [];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn((...args: unknown[]) => {
        selectArgs = args;
        return {
          eq: vi.fn((...eArgs: unknown[]) => {
            eqArgs = eArgs;
            return Promise.resolve({ count: mockCount, error: mockError });
          }),
        };
      }),
    })),
  },
}));

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useCatalogHasItems', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockCount = null;
    mockError = null;
    selectArgs = [];
    eqArgs = [];
  });

  // Состояние прода на 17.09.2026: вещей ноль. Именно здесь заголовок
  // «Aucun outil dans cette zone» был неправдой, а кнопка «расширить» вела во
  // второй пустой экран.
  it('ноль вещей — каталог пуст', async () => {
    mockCount = 0;
    const { result } = renderHook(() => useCatalogHasItems(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.catalogIsEmpty).toBe(true);
  });

  it('есть вещи — каталог не пуст, и прежний текст остаётся верным', async () => {
    mockCount = 3;
    const { result } = renderHook(() => useCatalogHasItems(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.catalogIsEmpty).toBe(false);
  });

  // Самое важное свойство. «Каталог пуст» — сильное утверждение; сделать его из
  // неотвеченного запроса значит показать человеку неправду при первом обрыве
  // сети. undefined читается вызывающим как «не пуст» и оставляет прежний
  // текст, который верен всегда.
  it('отказ запроса НЕ выдаётся за пустой каталог', async () => {
    mockError = { message: 'network down' };
    const { result } = renderHook(() => useCatalogHasItems(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.catalogIsEmpty).toBeUndefined();
  });

  it('пока ответа нет, утверждения тоже нет', () => {
    mockCount = 0;
    const { result } = renderHook(() => useCatalogHasItems(), { wrapper });
    expect(result.current.catalogIsEmpty).toBeUndefined();
  });

  // Считается то, что посетитель и правда может арендовать: строки без
  // колонок (head) и только доступные. Владелец, скрывший всё, для посетителя
  // неотличим от пустого каталога — и врать ему «нет в этой зоне» так же нельзя.
  it('считает доступные вещи, не тянет колонок', async () => {
    mockCount = 0;
    const { result } = renderHook(() => useCatalogHasItems(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(selectArgs[1]).toMatchObject({ count: 'exact', head: true });
    expect(eqArgs).toEqual(['available', true]);
  });
});
