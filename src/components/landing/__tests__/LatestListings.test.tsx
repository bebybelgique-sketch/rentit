import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BrowseFilters } from '../../../hooks/useBrowseItems'

// Лента под первым экраном: только настоящие объявления, и никакой ленты,
// пока их нет. Примеры («Mini-pelle 1,5 t · Rhisnes») жили только в макете
// и подписаны там как примеры — сюда они попасть не должны.

let rows: unknown[] | undefined
let lastFilters: BrowseFilters | undefined

vi.mock('../../../hooks/useBrowseItems', () => ({
  useBrowseItems: (f: BrowseFilters) => { lastFilters = f; return { data: rows } },
}))

import LatestListings from '../LatestListings'

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `id-${n}`, title: `Outil ${n}`, category: 'power_tools', price_per_day: 10 + n,
  address: `Commune ${n}`, photos: [], ...extra,
})

const renderIt = () => render(<MemoryRouter><LatestListings /></MemoryRouter>)

describe('лента последних объявлений', () => {
  beforeEach(() => { rows = undefined; lastFilters = undefined })

  it('пока ответа нет — ленты нет', () => {
    const { container } = renderIt()
    expect(container).toBeEmptyDOMElement()
  })

  it('пустой каталог — ленты нет, а не пустая коробка', () => {
    rows = []
    const { container } = renderIt()
    expect(container).toBeEmptyDOMElement()
  })

  it('показывает настоящие вещи со ссылкой на страницу вещи', () => {
    rows = [row(1, { photos: ['https://example.test/a.jpg'] })]
    renderIt()
    const link = screen.getByRole('link', { name: /outil 1/i })
    expect(link).toHaveAttribute('href', '/item/id-1')
    expect(link).toHaveTextContent('€11')
    expect(link).toHaveTextContent('Commune 1')
  })

  it('просит у базы пять строк, а не двести', () => {
    rows = []
    renderIt()
    expect(lastFilters?.limit).toBe(5)
  })

  it('больше пяти не рисует, даже если пришло больше', () => {
    rows = Array.from({ length: 8 }, (_, i) => row(i))
    renderIt()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })
})
