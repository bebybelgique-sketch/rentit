import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  count: 0,
}))

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../../../hooks/useActivity', () => ({
  useUnreadActivity: () => ({ data: { count: mocks.count, bookingIds: new Set() } }),
}))

import ActivityBell from '../ActivityBell'

const renderBell = () => render(<MemoryRouter><ActivityBell /></MemoryRouter>)

beforeEach(() => {
  mocks.user = { id: 'u1' }
  mocks.count = 0
})

describe('колокольчик', () => {
  it('ведёт в ленту; без непрочитанного — без числа', () => {
    renderBell()
    const link = screen.getByRole('link', { name: 'Activité' })
    expect(link).toHaveAttribute('href', '/activity')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('число непрочитанного — видно и сказано словами', () => {
    mocks.count = 3
    renderBell()
    expect(screen.getByRole('link', { name: 'Activité — 3 non lues' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3')
  })

  it('больше девяти — «9+»', () => {
    mocks.count = 27
    renderBell()
    expect(screen.getByRole('status')).toHaveTextContent('9+')
  })

  it('без входа колокольчика нет', () => {
    mocks.user = null
    const { container } = renderBell()
    expect(container).toBeEmptyDOMElement()
  })
})
