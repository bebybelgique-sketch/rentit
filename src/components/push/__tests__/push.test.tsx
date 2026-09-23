import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PushSnapshot } from '../../../lib/pushState'

/**
 * Карточки A/B/D, полоса C и строка F — как их видит человек.
 *
 * Состояние устройства подменяется целиком (usePushState), действия —
 * тоже (enablePush / disablePush): браузерного push в jsdom нет, и
 * проверять здесь можно только то, что экран делает с ответом. Сама
 * подписка замерена в настоящих Chrome и Edge.
 *
 * Память об отказах — НАСТОЯЩАЯ, в localStorage jsdom: правило «7 дней /
 * два отказа» проверяется целиком, от нажатия до записи.
 */

const mocks = vi.hoisted(() => ({
  snapshot: null as unknown as PushSnapshot,
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  subscribeSilently: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' }, accessToken: 't', loading: false }) }))
vi.mock('../../../hooks/usePushState', () => ({ usePushState: () => mocks.snapshot }))
vi.mock('../../../lib/pushState', () => ({
  enablePush: mocks.enablePush,
  disablePush: mocks.disablePush,
  subscribeSilently: mocks.subscribeSilently,
}))

import PushOfferCard from '../PushOfferCard'
import PushBlockedBanner from '../PushBlockedBanner'
import PushSettingsRow from '../PushSettingsRow'
import { EdgeError } from '../../../lib/edgeInvoke'

const READY: PushSnapshot = { phase: 'ready', capability: 'supported', configured: true, permission: 'default', subscribed: false }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.snapshot = READY
})

describe('карточка A — после заявки', () => {
  it('спрашивает НАШИМИ словами, окно браузера не открывает само', () => {
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    expect(screen.getByRole('heading', { name: 'Savoir quand Ramzan répond ?' })).toBeInTheDocument()
    expect(screen.getByText(/dès que Ramzan accepte ou refuse/)).toBeInTheDocument()
    expect(mocks.enablePush).not.toHaveBeenCalled()
  })

  it('«Me prévenir» → разрешение → строка «activées»', async () => {
    mocks.enablePush.mockResolvedValue('granted')
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    fireEvent.click(screen.getByRole('button', { name: 'Me prévenir' }))
    expect(await screen.findByText('Notifications activées sur cet appareil.')).toBeInTheDocument()
    expect(mocks.enablePush).toHaveBeenCalledWith('fr')
  })

  it('«Pas maintenant» → строка про Locations и запись отказа', () => {
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pas maintenant' }))
    expect(screen.getByText("D'accord. La réponse apparaîtra dans Locations.")).toBeInTheDocument()
    expect(localStorage.getItem('push_dismissed_count')).toBe('1')
    expect(Number(localStorage.getItem('push_dismissed_at'))).toBeGreaterThan(0)
  })

  it('отказ в окне браузера — та же строка, без записи «не сейчас»', async () => {
    mocks.enablePush.mockResolvedValue('denied')
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    fireEvent.click(screen.getByRole('button', { name: 'Me prévenir' }))
    expect(await screen.findByText("D'accord. La réponse apparaîtra dans Locations.")).toBeInTheDocument()
    expect(localStorage.getItem('push_dismissed_count')).toBeNull()
  })

  it('окно браузера закрыто без ответа — считается «не сейчас»', async () => {
    mocks.enablePush.mockResolvedValue('dismissed')
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    fireEvent.click(screen.getByRole('button', { name: 'Me prévenir' }))
    await screen.findByText("D'accord. La réponse apparaîtra dans Locations.")
    expect(localStorage.getItem('push_dismissed_count')).toBe('1')
  })

  it('отказ сервера — текст на языке человека, а не код', async () => {
    mocks.enablePush.mockRejectedValue(new EdgeError('push_not_configured', 503))
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    fireEvent.click(screen.getByRole('button', { name: 'Me prévenir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Les notifications ne sont pas encore disponibles')
  })

  it('имени нет — «le propriétaire», а не пустота', () => {
    render(<PushOfferCard trigger="request" ownerFirstName={null} />)
    expect(screen.getByRole('heading', { name: 'Savoir quand le propriétaire répond ?' })).toBeInTheDocument()
  })

  it('недавний отказ — карточки нет', () => {
    localStorage.setItem('push_dismissed_count', '1')
    localStorage.setItem('push_dismissed_at', String(Date.now() - 1000))
    const { container } = render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('разрешение уже есть — подписывает молча, карточки нет', async () => {
    mocks.snapshot = { ...READY, permission: 'granted' }
    const { container } = render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    await waitFor(() => expect(mocks.subscribeSilently).toHaveBeenCalledWith('fr'))
    expect(container).toBeEmptyDOMElement()
  })

  it('пока состояние не выяснено — ничего, без мигания карточки', () => {
    mocks.snapshot = { ...READY, phase: 'probing' }
    const { container } = render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('карточка B — после публикации', () => {
  it('свой текст и своя строка после отказа', () => {
    render(<PushOfferCard trigger="publish" />)
    expect(screen.getByRole('heading', { name: "Être prévenu quand quelqu'un demande ?" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pas maintenant' }))
    expect(screen.getByText("D'accord. Les demandes apparaîtront dans Locations.")).toBeInTheDocument()
  })
})

describe('карточка D — iPhone вне экрана «Домой»', () => {
  it('три шага и «Plus tard», кнопки «Me prévenir» нет', () => {
    mocks.snapshot = { ...READY, capability: 'ios-needs-install' }
    render(<PushOfferCard trigger="request" ownerFirstName="Ramzan" />)
    expect(screen.getByText(/ne marchent que si RentIt est sur l'écran d'accueil/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Me prévenir' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
    expect(localStorage.getItem('push_dismissed_count')).toBe('1')
  })
})

describe('полоса C', () => {
  it('заблокировано и заявка ждёт — видна; «Compris» закрывает навсегда', () => {
    mocks.snapshot = { ...READY, permission: 'denied' }
    const { unmount } = render(<PushBlockedBanner hasPendingRequest />)
    expect(screen.getByRole('heading', { name: 'Les notifications sont bloquées' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Compris' }))
    expect(screen.queryByText('Les notifications sont bloquées')).toBeNull()
    unmount()
    render(<PushBlockedBanner hasPendingRequest />)
    expect(screen.queryByText('Les notifications sont bloquées')).toBeNull()
  })

  it('заявок нет — не видна', () => {
    mocks.snapshot = { ...READY, permission: 'denied' }
    const { container } = render(<PushBlockedBanner hasPendingRequest={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('строка F в Профиле', () => {
  it('выключено → «Activer» включает', async () => {
    mocks.enablePush.mockResolvedValue('granted')
    render(<PushSettingsRow />)
    expect(screen.getByText('Désactivées sur cet appareil')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Activer' }))
    await waitFor(() => expect(mocks.enablePush).toHaveBeenCalledWith('fr'))
  })

  it('включено → «Désactiver» выключает', async () => {
    mocks.snapshot = { ...READY, permission: 'granted', subscribed: true }
    mocks.disablePush.mockResolvedValue(undefined)
    render(<PushSettingsRow />)
    expect(screen.getByText('Activées sur cet appareil')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }))
    await waitFor(() => expect(mocks.disablePush).toHaveBeenCalled())
  })

  it('отказ сервера при выключении — сказано словами', async () => {
    mocks.snapshot = { ...READY, permission: 'granted', subscribed: true }
    mocks.disablePush.mockRejectedValue(new EdgeError('network'))
    render(<PushSettingsRow />)
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }))
    expect(await screen.findByRole('alert')).not.toHaveTextContent('network')
  })

  it('заблокировано — только объяснение, без кнопки', () => {
    mocks.snapshot = { ...READY, permission: 'denied' }
    render(<PushSettingsRow />)
    expect(screen.getByText(/Bloquées par le navigateur/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('канал не заведён — строки нет вовсе', () => {
    mocks.snapshot = { ...READY, configured: false }
    const { container } = render(<PushSettingsRow />)
    expect(container).toBeEmptyDOMElement()
  })
})
