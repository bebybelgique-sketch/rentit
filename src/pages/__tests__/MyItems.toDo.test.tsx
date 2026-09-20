import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let items: Array<Record<string, unknown>> = [];

// Заглушка supabase обязательна: MyItems тянет BookingOwnerActions →
// edgeInvoke → lib/supabase, а тот БРОСАЕТ прямо при загрузке модуля без
// VITE_SUPABASE_URL. Локально переменная в .env, в CI её нет.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('../../hooks/useOwnerItems', () => ({
  useOwnerItems: () => ({ data: items, isLoading: false, isError: false }),
}));
vi.mock('../../hooks/mutations/useSetItemAvailability', () => ({
  useSetItemAvailability: () => ({ mutate: vi.fn(), error: null }),
}));
vi.mock('../../hooks/mutations/useDeleteItem', () => ({
  useDeleteItem: () => ({ mutate: vi.fn(), error: null }),
}));

import MyItems from '../MyItems';

// Provider нужен потому, что блок дел рисует BookingOwnerActions, а тот
// зовёт useMutation. Прежний тест «Моих вещей» до него не доходил: заявки
// жили внутри карточек, и ни один его сценарий их не показывал.
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><MyItems /></MemoryRouter>
    </QueryClientProvider>,
  );

const NOW = new Date('2026-09-20T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

const request = (id: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  item_id: 'i-1',
  renter_id: 'r-1',
  status: 'pending_approval',
  start_date: '2026-09-25',
  end_date: '2026-09-27',
  total_days: 2,
  total_price: 36,
  request_message: null,
  created_at: createdAt,
  renter: { id: 'r-1', full_name: 'Marc D.', avatar_url: null },
  ...extra,
});

const item = (id: string, title: string, bookings: unknown[], available = true) => ({
  id, title, category: 'power_tools', available,
  price_per_day: 18, deposit: 0, photos: [], bookings,
});

const toDoBlock = () => screen.getByRole('heading', { name: 'À faire maintenant' }).closest('section')!;

describe('«Мои вещи»: дела — первым экраном', () => {
  beforeEach(() => {
    items = [];
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => { vi.useRealTimers(); });

  // ГЛАВНЫЙ ИНВАРИАНТ. Заявки лежали ВНУТРИ карточек своих вещей: владелец
  // с пятью вещами и одной заявкой искал её глазами по пяти карточкам.
  // Дашборд отвечает на вопрос «что от меня сейчас требуется», а не «какие
  // у меня вещи».
  it('заявки собраны в один блок поверх списка вещей', () => {
    items = [
      item('i-1', 'Perceuse', [request('b-1', hoursAgo(2))]),
      item('i-2', 'Scie', [request('b-2', hoursAgo(1), { item_id: 'i-2' })]),
    ];
    renderPage();

    const block = toDoBlock();
    expect(within(block).getByText('Perceuse')).toBeInTheDocument();
    expect(within(block).getByText('Scie')).toBeInTheDocument();
  });

  // В плоском списке название вещи — единственное, что отличает одну заявку
  // от другой. Без него две заявки от разных людей на разные вещи выглядят
  // одинаково.
  it('каждая заявка названа своей вещью', () => {
    items = [item('i-1', 'Perceuse SDS', [request('b-1', hoursAgo(3))])];
    renderPage();
    expect(within(toDoBlock()).getByText('Perceuse SDS')).toBeInTheDocument();
  });

  // Порядок — по сроку. Окно у всех одинаковое, значит созданная раньше
  // сгорит первой.
  it('первой идёт та, что скорее сгорит', () => {
    items = [item('i-1', 'Perceuse', [
      request('b-fresh', hoursAgo(1)),
      request('b-old', hoursAgo(22)),
    ])];
    renderPage();

    const texts = within(toDoBlock()).getAllByText(/pour répondre|Délai dépassé/);
    // Старая заявка (осталось ~2 ч) обязана стоять выше свежей (~23 ч).
    expect(texts[0].textContent).toMatch(/2 h/);
  });

  // Срок исполняет планировщик: `pending_approval` + `created_at` старше
  // суток → `expired`. Владелец не видел его НИГДЕ, хотя арендатору он
  // обещан на странице вещи вслух.
  it('показывает, сколько осталось ответить', () => {
    items = [item('i-1', 'Perceuse', [request('b-1', hoursAgo(20))])];
    renderPage();
    expect(within(toDoBlock()).getByText(/Il reste 4 h pour répondre/)).toBeInTheDocument();
  });

  // Планировщик ходит раз в полчаса, поэтому заявка переживает срок и
  // какое-то время лежит просроченной. «0 ч» соврало бы в обе стороны.
  it('после срока говорит, что заявка уже отменяется, а не «0 ч»', () => {
    items = [item('i-1', 'Perceuse', [request('b-1', hoursAgo(25))])];
    renderPage();
    expect(within(toDoBlock()).getByText(/Délai dépassé/)).toBeInTheDocument();
    expect(within(toDoBlock()).queryByText(/0 h/)).not.toBeInTheDocument();
  });

  // Вкладка «Actifs» прячет СКРЫТЫЕ ВЕЩИ. Заявка на скрытую вещь никуда не
  // девается, и ответить на неё всё равно надо: спрятать дело вместе с
  // вещью значило бы потерять его молча.
  it('заявка на скрытую вещь из дел не исчезает', () => {
    items = [item('i-1', 'Perceuse cachée', [request('b-1', hoursAgo(2))], false)];
    renderPage();
    expect(within(toDoBlock()).getByText('Perceuse cachée')).toBeInTheDocument();
  });

  // Два места для одного действия — ровно то, что чинили на «Mes locations».
  it('в карточке вещи заявка больше не дублируется', () => {
    items = [item('i-1', 'Perceuse', [request('b-1', hoursAgo(2))])];
    renderPage();
    expect(screen.queryByText('Demandes en attente')).not.toBeInTheDocument();
    // А сводка-ярлык на карточке остаётся: это не второе место действия.
    expect(screen.getByText('1 demande')).toBeInTheDocument();
  });

  it('без заявок блока нет вовсе', () => {
    items = [item('i-1', 'Perceuse', [])];
    renderPage();
    expect(screen.queryByRole('heading', { name: 'À faire maintenant' })).not.toBeInTheDocument();
  });

  // Подтверждённые брони — не дело, а состояние: отвечать на них нечего.
  it('подтверждённая бронь в дела не попадает', () => {
    items = [item('i-1', 'Perceuse', [
      request('b-1', hoursAgo(2), { status: 'confirmed' }),
    ])];
    renderPage();
    expect(screen.queryByRole('heading', { name: 'À faire maintenant' })).not.toBeInTheDocument();
  });
});
