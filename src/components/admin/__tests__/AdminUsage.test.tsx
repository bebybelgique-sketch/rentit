import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const state = vi.hoisted(() => ({
  value: { isLoading: false, isError: false, error: null as Error | null, data: [] as Array<{ day: string; event: string; count: number }> },
}))

vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.mock('../../../hooks/useAdminUsage', () => ({
  useAdminUsage: () => state.value,
}))

import AdminUsage from '../AdminUsage'

const today = new Date().toISOString().slice(0, 10)

describe('блок «Utilisation» в /admin', () => {
  beforeEach(() => {
    state.value = { isLoading: false, isError: false, error: null, data: [] }
  })

  // Без этой строки 40 открытий читались бы как «40 человек пришло».
  it('говорит, кого описывают цифры', () => {
    render(<AdminUsage enabled />)
    expect(screen.getByText(/Seulement les visiteurs qui ont accepté « Analytique »/)).toBeInTheDocument()
  })

  it('пусто — так и сказано, и точка пересмотра видна с нулём', () => {
    render(<AdminUsage enabled />)
    expect(screen.getByText('Aucune donnée pour l’instant.')).toBeInTheDocument()
    expect(screen.getByText(/0 \/ 300/)).toBeInTheDocument()
  })

  it('итоги по событиям и доли пути', () => {
    state.value.data = [
      { day: today, event: 'home_view', count: 40 },
      { day: today, event: 'hero_search', count: 10 },
      { day: today, event: 'browse_view', count: 20 },
      { day: today, event: 'browse_empty', count: 15 },
      { day: today, event: 'demand_sent', count: 3 },
    ]
    render(<AdminUsage enabled />)
    const row = screen.getByRole('row', { name: /Ouvertures de l’accueil/ })
    expect(row).toHaveTextContent('40')
    expect(screen.getByText(/40 \/ 300/)).toBeInTheDocument()
    expect(screen.getByText('Accueil → recherche').previousSibling).toHaveTextContent(/25\s?%/)
  })

  it('точка пересмотра достигнута — сказано прямо', () => {
    state.value.data = [{ day: today, event: 'home_view', count: 300 }]
    render(<AdminUsage enabled />)
    expect(screen.getByText(/c’est le moment de revoir le premier écran/)).toBeInTheDocument()
  })

  it('сбой чтения — это сбой, а не «данных нет»', () => {
    state.value = { isLoading: false, isError: true, error: new Error('internal_error'), data: [] }
    render(<AdminUsage enabled />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Aucune donnée pour l’instant.')).not.toBeInTheDocument()
  })
})
