import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Хранилище состояния уведомлений: порядок шагов при включении и
 * выключении, и то, что выход из учётки не оставляет чужого состояния.
 *
 * Браузерная часть (./push) подменена: подписка на настоящих службах
 * замерена в Chrome и Edge, здесь — только оркестровка.
 */

const mocks = vi.hoisted(() => ({
  subscribeThisDevice: vi.fn(),
  unsubscribeThisDevice: vi.fn(),
  isThisDeviceSubscribed: vi.fn(),
  fetchPublicKey: vi.fn(),
  env: {
    userAgent: 'Chrome', platform: 'Win32', maxTouchPoints: 0, standalone: false,
    hasServiceWorker: true, hasPushManager: true, hasNotification: true,
  },
  permission: 'default' as NotificationPermission,
  memory: { dismissedCount: 0, dismissedAt: null as number | null, optedOut: false, blockedBannerDismissed: false },
}))

vi.mock('../push', () => ({
  subscribeThisDevice: mocks.subscribeThisDevice,
  unsubscribeThisDevice: mocks.unsubscribeThisDevice,
  isThisDeviceSubscribed: mocks.isThisDeviceSubscribed,
  fetchPublicKey: mocks.fetchPublicKey,
  readEnvironment: () => mocks.env,
  readPermission: () => mocks.permission,
  readOfferMemory: () => mocks.memory,
  writeOfferMemory: (m: typeof mocks.memory) => { mocks.memory = m },
}))

import {
  disablePush, enablePush, getPushSnapshot, probePush, resetPushState, subscribeSilently,
} from '../pushState'

const requestPermission = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permission = 'default'
  mocks.memory = { dismissedCount: 0, dismissedAt: null, optedOut: false, blockedBannerDismissed: false }
  mocks.fetchPublicKey.mockResolvedValue('BKEY')
  mocks.isThisDeviceSubscribed.mockResolvedValue(false)
  mocks.subscribeThisDevice.mockResolvedValue(undefined)
  mocks.unsubscribeThisDevice.mockResolvedValue(undefined)
  requestPermission.mockImplementation(async () => mocks.permission)
  vi.stubGlobal('Notification', { requestPermission, permission: 'default' })
  resetPushState()
})

describe('выяснение состояния', () => {
  it('канал заведён, подписки нет', async () => {
    await probePush()
    expect(getPushSnapshot()).toMatchObject({ phase: 'ready', configured: true, subscribed: false })
  })

  it('канал не заведён — о подписке сервер даже не спрашивают', async () => {
    mocks.fetchPublicKey.mockResolvedValue(null)
    await probePush()
    expect(getPushSnapshot()).toMatchObject({ phase: 'ready', configured: false })
    expect(mocks.isThisDeviceSubscribed).not.toHaveBeenCalled()
  })

  it('push не поддерживается — ни одного запроса', async () => {
    mocks.env = { ...mocks.env, hasPushManager: false }
    await probePush()
    expect(getPushSnapshot()).toMatchObject({ phase: 'ready', capability: 'unsupported' })
    expect(mocks.fetchPublicKey).not.toHaveBeenCalled()
    mocks.env = { ...mocks.env, hasPushManager: true }
  })

  /**
   * Выяснение, начатое до выхода, заканчивается после — и не имеет права
   * записать «подписан» в состояние следующего человека.
   */
  it('выход посреди выяснения не оставляет чужой подписки', async () => {
    let finish: (v: boolean) => void = () => {}
    mocks.isThisDeviceSubscribed.mockReturnValue(new Promise<boolean>((r) => { finish = r }))
    const probing = probePush()
    await vi.waitFor(() => expect(mocks.isThisDeviceSubscribed).toHaveBeenCalled())
    resetPushState()
    finish(true)
    await probing
    expect(getPushSnapshot()).toMatchObject({ phase: 'idle', subscribed: false })
  })
})

describe('включение', () => {
  it('окно браузера → «да» → подписка → отметка «выключил сам» снята', async () => {
    mocks.memory = { ...mocks.memory, optedOut: true }
    requestPermission.mockImplementation(async () => { mocks.permission = 'granted'; return 'granted' })
    await expect(enablePush('nl')).resolves.toBe('granted')
    expect(mocks.subscribeThisDevice).toHaveBeenCalledWith('nl')
    expect(mocks.memory.optedOut).toBe(false)
    expect(getPushSnapshot()).toMatchObject({ permission: 'granted', subscribed: true })
  })

  it('разрешение уже есть — окна браузера нет', async () => {
    mocks.permission = 'granted'
    await enablePush('fr')
    expect(requestPermission).not.toHaveBeenCalled()
    expect(mocks.subscribeThisDevice).toHaveBeenCalled()
  })

  it('отказ в окне — без подписки', async () => {
    requestPermission.mockImplementation(async () => { mocks.permission = 'denied'; return 'denied' })
    await expect(enablePush('fr')).resolves.toBe('denied')
    expect(mocks.subscribeThisDevice).not.toHaveBeenCalled()
    expect(getPushSnapshot().permission).toBe('denied')
  })

  it('окно закрыто без ответа — «dismissed», без подписки', async () => {
    requestPermission.mockResolvedValue('default')
    await expect(enablePush('fr')).resolves.toBe('dismissed')
    expect(mocks.subscribeThisDevice).not.toHaveBeenCalled()
  })

  it('сбой подписки уходит к экрану исключением', async () => {
    mocks.permission = 'granted'
    mocks.subscribeThisDevice.mockRejectedValue(new Error('сеть'))
    await expect(enablePush('fr')).rejects.toThrow('сеть')
    expect(getPushSnapshot().subscribed).toBe(false)
  })
})

describe('выключение и тихая подписка', () => {
  it('«Désactiver» ставит отметку ТОЛЬКО после успеха', async () => {
    mocks.unsubscribeThisDevice.mockRejectedValueOnce(new Error('сеть'))
    await expect(disablePush()).rejects.toThrow()
    expect(mocks.memory.optedOut).toBe(false)
    await disablePush()
    expect(mocks.memory.optedOut).toBe(true)
  })

  it('выключившего молча не подписывают', async () => {
    mocks.permission = 'granted'
    mocks.memory = { ...mocks.memory, optedOut: true }
    await subscribeSilently('fr')
    expect(mocks.subscribeThisDevice).not.toHaveBeenCalled()
  })

  it('без разрешения молча не подписывают', async () => {
    await subscribeSilently('fr')
    expect(mocks.subscribeThisDevice).not.toHaveBeenCalled()
  })

  it('тихая подписка не бросает', async () => {
    mocks.permission = 'granted'
    mocks.subscribeThisDevice.mockRejectedValue(new Error('сеть'))
    await expect(subscribeSilently('fr')).resolves.toBeUndefined()
  })
})
