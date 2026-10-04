import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// «Avec opérateur» на странице вещи (миграция 54): предложение видно среди
// условий, выбор добавляет строку в разбор и уходит в заявку флагом — сумму
// сервер берёт из вещи. Ставки — из настоящего объявления 03.10: машина
// 90 € в день; оператор 160 € в день.

const edge = vi.hoisted(() => ({ invoke: vi.fn() }));
// Пакеты аренды задаёт тест: по умолчанию их нет, только цена дня.
const rates = vi.hoisted(() => ({ price_weekend: null as number | null, price_week: null as number | null }));

vi.mock('../../lib/edgeInvoke', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/edgeInvoke')>()),
  invokeEdge: edge.invoke,
}));
vi.mock('../../lib/supabase', () => {
  const item = {
    id: 'i-1', owner_id: 'u-owner', title: 'Mini-pelle 1 t', description: 'Kubota, 3 godets', price_per_day: 90,
    price_3days: null, price_week: null, price_weekend: null, deposit: 0, late_fee_per_day: null,
    delivery_fee: null, delivery_radius_km: null, operator_fee_per_day: 160, category: 'construction',
    condition: 'good', address: '1300 Wavre', lat: null, lng: null, available: true, quantity: 1,
    min_notice_days: 0, buffer_days: 0, photos: [],
    users: { id: 'u-owner', full_name: 'Loueur', avatar_url: null, phone_verified: false, rating_as_owner: null, is_pro: false },
  };
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) c[m] = () => c;
    c.single = async () => ({ data: table === 'items' ? { ...item, ...rates } : null, error: null });
    c.maybeSingle = async () => ({ data: null, error: null });
    c.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    return c;
  };
  return {
    supabase: {
      from: (table: string) => chain(table),
      rpc: async () => ({ data: null, error: null }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      functions: { invoke: vi.fn() },
    },
  };
});
vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-renter' };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useMyInvite', () => ({ useMyInvite: () => ({ data: null }) }));
vi.mock('../../components/push/PushOfferCard', () => ({ default: () => null }));

import ItemDetail from '../ItemDetail';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/item/i-1']}>
        <Routes><Route path="/item/:id" element={<ItemDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const day = (n: number) =>
  Array.from(document.querySelectorAll('.cal-day.available')).find((d) => d.textContent === String(n)) as HTMLElement;

describe('оператор на странице вещи', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    edge.invoke.mockReset().mockResolvedValue({ booking_id: 'b-new' });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('предложение видно среди условий', async () => {
    renderPage();
    expect(await screen.findByText('Avec opérateur : +€160.00 / jour')).toBeInTheDocument();
  });

  it('выбор оператора — строка в разборе и флаг в заявке', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    // Вторник 13 — среда 14 октября: два дня.
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '2' } });
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
    expect(screen.getByText('€320.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    await screen.findByText('Demande envoyée !');
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ operator_requested: true, operator_days: 2 }));
  });

  // Значения по умолчанию у дней оператора нет (аудит 04.10): до этого им
  // была вся бронь, и сб–пн молча считались тремя днями работы.
  it('оператор без дней — суммы нет, заявка не уходит', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(10));
    fireEvent.click(day(12));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    expect(await screen.findByText('Opérateur : jours à préciser')).toBeInTheDocument();
    expect(screen.queryByText(/^Opérateur €160\.00 × \d+ j$/)).toBeNull();
    expect((screen.getByLabelText('Jours avec opérateur') as HTMLInputElement).value).toBe('');
    const send = screen.getByRole('button', { name: 'Indiquez les jours avec opérateur' });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(edge.invoke).not.toHaveBeenCalled();
    // Стёртое поле — снова «не выбрано», а не 1.
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Indiquez les jours avec opérateur' })).toBeDisabled();
  });

  // Дни оператора — не дни аренды (миграция 56): сб–пн — пакет выходных с
  // возвратом в понедельник, а оператор работает два дня.
  it('дни оператора задаёт арендатор — сумма и заявка по ним', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    // Суббота 10 — понедельник 12 октября: три дня брони.
    fireEvent.click(day(10));
    fireEvent.click(day(12));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    expect(screen.queryByText('Opérateur €160.00 × 3 j')).toBeNull();
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '2' } });
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    await screen.findByText('Demande envoyée !');
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ operator_requested: true, operator_days: 2 }));
  });

  it('дней оператора не больше, чем дней брони', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '9' } });
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
  });

  it('без выбора — в заявке оператора нет', async () => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(13));
    fireEvent.click(day(14));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une demande de réservation' }));
    await screen.findByText('Demande envoyée !');
    expect(edge.invoke).toHaveBeenCalledWith('request-rental', expect.objectContaining({ operator_requested: false }));
  });
});

// Оператор считается отдельно от пакетов аренды (ревью GPT 03.10, «weekend ×
// operator»). Аренда берёт самую выгодную раскладку по пакетам, а оператор —
// цена × дни его работы, которые называет арендатор. Пакеты — из того же
// объявления: выходные 150 €, неделя 350 €.
describe('оператор и пакеты аренды не смешиваются', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    edge.invoke.mockReset().mockResolvedValue({ booking_id: 'b-new' });
    rates.price_weekend = 150;
    rates.price_week = 350;
  });
  afterEach(() => {
    vi.useRealTimers();
    rates.price_weekend = null;
    rates.price_week = null;
  });

  const pick = async (from: number, to: number, operatorDays: number) => {
    renderPage();
    await screen.findByText('Mini-pelle 1 t');
    fireEvent.click(day(from));
    fireEvent.click(day(to));
    fireEvent.click(screen.getByLabelText('Avec opérateur (+€160.00 / jour)'));
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: String(operatorDays) } });
  };
  // Сумма строки разбора стоит справа от подписи.
  const amount = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

  it('сб–вс: пакет выходных 150 и оператор 2 × 160', async () => {
    await pick(10, 11, 2);
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
    expect(amount('€150.00 × 1 week-end')).toBe('€150.00');
    expect(amount('Opérateur €160.00 × 2 j')).toBe('€320.00');
    expect(amount('Total estimé')).toBe('€470.00');
  });

  it('пт–пн: день и пакет сб–пн; дней оператора — сколько назовёт арендатор', async () => {
    await pick(9, 12, 4);
    expect(await screen.findByText('Opérateur €160.00 × 4 j')).toBeInTheDocument();
    expect(amount('€90.00 × 1 jour')).toBe('€90.00');
    expect(amount('€150.00 × 1 week-end')).toBe('€150.00');
    expect(amount('Total estimé')).toBe('€880.00');
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '2' } });
    expect(await screen.findByText('Opérateur €160.00 × 2 j')).toBeInTheDocument();
    expect(amount('Total estimé')).toBe('€560.00');
  });

  it('три будних дня: аренда по дням, оператор 3 × 160', async () => {
    await pick(13, 15, 3);
    expect(await screen.findByText('Opérateur €160.00 × 3 j')).toBeInTheDocument();
    expect(amount('€90.00 × 3 jours')).toBe('€270.00');
    expect(amount('Total estimé')).toBe('€750.00');
  });

  it('семь дней: неделя 350, оператор по своим дням', async () => {
    await pick(12, 18, 7);
    expect(await screen.findByText('Opérateur €160.00 × 7 j')).toBeInTheDocument();
    expect(amount('€350.00 × 1 semaine')).toBe('€350.00');
    expect(amount('Total estimé')).toBe('€1470.00');
    fireEvent.change(screen.getByLabelText('Jours avec opérateur'), { target: { value: '3' } });
    expect(await screen.findByText('Opérateur €160.00 × 3 j')).toBeInTheDocument();
    expect(amount('Total estimé')).toBe('€830.00');
  });
});
