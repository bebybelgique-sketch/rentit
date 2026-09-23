import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ClientErrorRow } from '../../../hooks/useAdminErrors'

/**
 * Вкладка «Erreurs»: счётчик первым, путь, версия, след по раскрытию.
 */

const mocks = vi.hoisted(() => ({
  state: { isLoading: false, isError: false, error: null as Error | null, data: [] as ClientErrorRow[] },
}))
vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.mock('../../../hooks/useAdminErrors', () => ({ useAdminErrors: () => mocks.state }))

import AdminErrors from '../AdminErrors'

const row: ClientErrorRow = {
  fingerprint: '0123456789abcdef0123456789abcdef',
  day: '2026-09-23',
  kind: 'render',
  message: "TypeError: Cannot read properties of undefined (reading 'title')",
  stack: 'TypeError: …\n    at Kt (https://rentit/assets/ItemDetail-abc.js:1:2)',
  path: '/item/42',
  release: 'a1b2c3d',
  user_agent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0',
  lang: 'nl',
  count: 12,
  first_seen: '2026-09-23T08:00:00Z',
  last_seen: '2026-09-23T10:00:00Z',
}

beforeEach(() => {
  mocks.state = { isLoading: false, isError: false, error: null, data: [] }
})

describe('AdminErrors', () => {
  it('поломка: сколько раз, что, где, какая сборка', () => {
    mocks.state.data = [row]
    render(<AdminErrors enabled />)
    expect(screen.getByText('12 fois')).toBeInTheDocument()
    expect(screen.getByText(row.message)).toBeInTheDocument()
    expect(screen.getByText('/item/42')).toBeInTheDocument()
    expect(screen.getByText(/version a1b2c3d/)).toBeInTheDocument()
    // След — по раскрытию: он длинный и нужен не всегда.
    fireEvent.click(screen.getByText('Trace'))
    expect(screen.getByText(/at Kt/)).toBeInTheDocument()
  })

  it('отчёты прогонов «E2E» не показываются', () => {
    mocks.state.data = [{ ...row, message: 'Error: E2E контроль приёма отчётов' }, { ...row, fingerprint: 'f'.repeat(32), message: 'E2E замер' }]
    render(<AdminErrors enabled />)
    expect(screen.queryByText(/E2E/)).toBeNull()
    expect(screen.getByText('Aucune erreur signalée ces 30 derniers jours.')).toBeInTheDocument()
  })

  it('пусто — так и сказано', () => {
    render(<AdminErrors enabled />)
    expect(screen.getByText('Aucune erreur signalée ces 30 derniers jours.')).toBeInTheDocument()
  })

  it('не загрузилось — сказано словами, а не кодом', () => {
    mocks.state = { isLoading: false, isError: true, error: new Error('forbidden'), data: [] }
    render(<AdminErrors enabled />)
    expect(screen.getByRole('alert')).toHaveTextContent("Les erreurs n'ont pas pu être chargées.")
  })
})
