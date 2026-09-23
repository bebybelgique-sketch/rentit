import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ActivityRow } from '../../domain/activity'

/**
 * «Activité»: что случилось за день — по дням, новое выделено, после
 * просмотра прочитано, а выделение держится до конца визита.
 */

const mocks = vi.hoisted(() => ({
  feed: { isLoading: false, isError: false, error: null as Error | null, data: [] as ActivityRow[] | undefined },
  mutate: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../hooks/useActivity', () => ({
  useActivityFeed: () => mocks.feed,
  useMarkActivityRead: () => ({ mutate: mocks.mutate }),
}))

import Activity from '../Activity'

const row = (id: string, created_at: string, read_at: string | null, kind: ActivityRow['kind'] = 'accepted'): ActivityRow => ({
  id, kind, booking_id: `b-${id}`, message_id: null, created_at, read_at,
  booking: {
    start_date: '2026-09-26', end_date: '2026-09-27', total_price: 30, renter_id: 'r', cancelled_by: null,
    item: { title: 'Perceuse', owner: { full_name: 'Ramzan Bekov' } }, renter: { full_name: 'Rachel Locataire' },
  },
  message: null,
})

const renderPage = () => render(<MemoryRouter><Activity /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-23T19:00:00+02:00'))
  mocks.feed = { isLoading: false, isError: false, error: null, data: [] }
})
afterEach(() => { vi.useRealTimers() })

describe('Activité', () => {
  it('события по дням, каждое ведёт на свою бронь', () => {
    mocks.feed.data = [
      row('today', '2026-09-23T15:00:00+00:00', null),
      row('yesterday', '2026-09-22T09:00:00+00:00', '2026-09-22T10:00:00+00:00', 'declined'),
    ]
    renderPage()
    expect(screen.getByRole('heading', { name: "Aujourd'hui" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hier' })).toBeInTheDocument()
    expect(screen.getByText('Ramzan B. a accepté').closest('a')).toHaveAttribute('href', '/my-rentals?booking=b-today')
    expect(screen.getByText('Ramzan B. a refusé')).toBeInTheDocument()
  })

  it('новое выделено; через полторы секунды всё отмечено прочитанным', async () => {
    mocks.feed.data = [row('n', '2026-09-23T15:00:00+00:00', null)]
    renderPage()
    const item = screen.getByText('Ramzan B. a accepté').closest('a')!
    expect(item).toHaveClass('is-new')
    expect(mocks.mutate).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1600) })
    expect(mocks.mutate).toHaveBeenCalledWith({ all: true })
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
  })

  it('выделение держится до конца визита, даже когда база уже «прочитано»', async () => {
    mocks.feed.data = [row('n', '2026-09-23T15:00:00+00:00', null)]
    const view = renderPage()
    await act(async () => { vi.advanceTimersByTime(1600) })
    // Лента перезагрузилась после отметки: read_at уже стоит.
    mocks.feed.data = [row('n', '2026-09-23T15:00:00+00:00', '2026-09-23T17:00:05+00:00')]
    view.rerender(<MemoryRouter><Activity /></MemoryRouter>)
    expect(screen.getByText('Ramzan B. a accepté').closest('a')).toHaveClass('is-new')
  })

  it('нечего отмечать — запрос не уходит', async () => {
    mocks.feed.data = [row('r', '2026-09-23T15:00:00+00:00', '2026-09-23T16:00:00+00:00')]
    renderPage()
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('пусто — объяснено, что сюда придёт и что без уведомлений тоже', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Rien de nouveau pour l’instant' })).toBeInTheDocument()
    expect(screen.getByText(/même si les notifications sont désactivées/)).toBeInTheDocument()
  })

  it('не загрузилось — словами', () => {
    mocks.feed = { isLoading: false, isError: true, error: new Error('permission denied'), data: undefined }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent("L'activité n'a pas pu être chargée.")
  })
})
