import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { MyInvite } from '../../../hooks/useMyInvite'

let invite: MyInvite | null | undefined
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }))
vi.mock('../../../hooks/useMyInvite', () => ({ useMyInvite: () => ({ data: invite }) }))

import InviteSection from '../InviteSection'

const LINK = `${window.location.origin}/?ref=AB12CD34`

describe('«Inviter un voisin»', () => {
  beforeEach(() => {
    invite = { code: 'AB12CD34', joined: 0 }
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })

  // Ссылка — на витрину, а не на регистрацию: сосед сначала видит, что
  // рядом есть что взять.
  it('ссылка ведёт на витрину с кодом и видна текстом', () => {
    render(<InviteSection />)
    expect(screen.getByRole('heading', { name: 'Inviter un voisin' })).toBeInTheDocument()
    expect(screen.getByText(LINK)).toBeInTheDocument()
  })

  it('WhatsApp уносит текст и ту же ссылку', () => {
    render(<InviteSection />)
    const href = screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href') ?? ''
    expect(decodeURIComponent(href)).toContain(LINK)
    expect(decodeURIComponent(href)).toContain('RentIt')
  })

  it('без системного «поделиться» ссылка копируется, и это сказано', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<InviteSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Partager mon lien' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK))
    expect(await screen.findByRole('button', { name: /Copié/ })).toBeInTheDocument()
  })

  it('копия не удалась — сказано, где взять ссылку, а не «скопировано»', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    render(<InviteSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Partager mon lien' }))
    expect(await screen.findByRole('button', { name: /Copie impossible/ })).toBeInTheDocument()
  })

  // Число, без имён: приглашённый не соглашался, чтобы его показывали.
  it('пришедшие — числом, и только когда они есть', () => {
    render(<InviteSection />)
    expect(screen.queryByRole('status')).toBeNull()
    invite = { code: 'AB12CD34', joined: 3 }
    render(<InviteSection />)
    expect(screen.getByRole('status')).toHaveTextContent('3 voisins ont rejoint RentIt grâce à vous')
  })

  it('нет кода — нет раздела', () => {
    invite = null
    const { container } = render(<InviteSection />)
    expect(container).toBeEmptyDOMElement()
  })
})
