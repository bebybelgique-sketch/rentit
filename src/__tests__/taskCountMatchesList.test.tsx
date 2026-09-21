import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * ЧИСЛО В ЗНАЧКЕ РАВНО ЧИСЛУ СТРОК В СПИСКЕ ДЕЛ.
 *
 * ── ПОЧЕМУ ЭТО ОТДЕЛЬНАЯ ПРОВЕРКА ────────────────────────────────────
 *
 * «Оба считают одним хуком, значит совпадут» — рассуждение, а не замер.
 * В тот же день рассуждение «провайдер же есть в App» стоило белой
 * страницы на всех адресах. Значок над списком, где «3», а строк две, —
 * та же порода: каждая половина по отдельности выглядит правильной.
 *
 * ── ПОЧЕМУ НЕ ПО ЖИВЫМ ДАННЫМ ────────────────────────────────────────
 *
 * Прогон по живой сборке с тестовой учёткой владельца показал НОЛЬ дел:
 * он подтвердил только ветку «дел нет — значка нет». Чтобы проверить
 * ненулевую, пришлось бы завести бронь в ПРОДАКШЕН-базе и потом её
 * оттуда убирать. Здесь то же дерево компонентов и те же хуки, но данные
 * заданы, а база не тронута.
 */

const NOW = new Date('2026-09-21T12:00:00+02:00')

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, accessToken: 'token' }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/**
 * Данные подменяются на уровне ЗАПРОСА, а не хука дел.
 *
 * Подменив useOwnerTasks, я проверил бы собственную заглушку: и значок, и
 * список получали бы одно число по построению, и расхождение стало бы
 * невозможным в тесте, оставаясь возможным в продукте.
 */
const bookings = [
  // Заявка — дело.
  { id: 'b1', item_id: 'i1', renter_id: 'r1', status: 'pending_approval', start_date: '2026-10-01', end_date: '2026-10-03', total_price: 30, total_days: 2, request_message: null, created_at: NOW.toISOString(), renter: null },
  // Передача сегодня — дело.
  { id: 'b2', item_id: 'i1', renter_id: 'r2', status: 'confirmed', start_date: '2026-09-21', end_date: '2026-09-23', total_price: 20, total_days: 2, request_message: null, created_at: '2026-09-10T10:00:00Z', renter: null },
  // Возврат просрочен — дело.
  { id: 'b3', item_id: 'i1', renter_id: 'r3', status: 'active', start_date: '2026-09-15', end_date: '2026-09-19', total_price: 40, total_days: 4, request_message: null, created_at: '2026-09-14T10:00:00Z', renter: null },
  // Бронь на будущее — НЕ дело.
  { id: 'b4', item_id: 'i1', renter_id: 'r4', status: 'confirmed', start_date: '2026-12-01', end_date: '2026-12-02', total_price: 10, total_days: 1, request_message: null, created_at: '2026-09-01T10:00:00Z', renter: null },
  // Завершённая аренда — НЕ дело: отзыв никого не держит.
  { id: 'b5', item_id: 'i1', renter_id: 'r5', status: 'completed', start_date: '2026-08-01', end_date: '2026-08-02', total_price: 10, total_days: 1, request_message: null, created_at: '2026-07-30T10:00:00Z', renter: null },
]

/** Три дела из пяти броней. Считается глазами по списку выше. */
const EXPECTED_TASKS = 3

vi.mock('../hooks/useOwnerItems', () => ({
  useOwnerItems: () => ({
    data: [{
      id: 'i1',
      owner_id: 'owner-1',
      title: 'Perceuse',
      available: true,
      photos: null,
      category: 'power',
      price_per_day: 10,
      bookings,
    }],
    isLoading: false,
    isError: false,
  }),
}))

import App from '../App'

describe('значок и список дел говорят одно и то же', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('число в значке совпадает с числом строк', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/my-items']}><App /></MemoryRouter>,
    )
    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()

    const section = await screen.findByRole('region', { name: /faire maintenant/i })
      .catch(() => null)
    // Блок дел размечен как <section> без подписи: ищем по заголовку.
    const heading = await screen.findByText(/À faire maintenant/i)
    const list = section ?? heading.parentElement!

    const rows = within(list).getAllByText('Perceuse')
    expect(rows, 'строк дел должно быть три').toHaveLength(EXPECTED_TASKS)

    const badges = container.querySelectorAll('.task-badge')
    expect(badges.length, 'значок обязан быть нарисован').toBeGreaterThan(0)
    for (const badge of badges) {
      expect(badge.textContent?.trim()).toBe(String(EXPECTED_TASKS))
    }
  })
})
