import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { QueryClient, MutationObserver } from '@tanstack/react-query'

// Одна ошибка — одно сообщение. До 03.10 общий тост срабатывал на каждой
// мутации поверх точной причины на месте: «Ces dates ne sont plus
// disponibles» и рядом «Une erreur est survenue. Veuillez réessayer plus
// tard». Теперь мутация говорит, кто сообщает (src/lib/mutationErrors.ts).

const toastError = vi.hoisted(() => vi.fn())
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }))

import { createMutationCache, type ErrorShownBy } from '../mutationErrors'

const failWith = async (errorShownBy?: ErrorShownBy) => {
  const client = new QueryClient({ mutationCache: createMutationCache() })
  const observer = new MutationObserver(client, {
    mutationFn: async () => { throw new Error('boom') },
    meta: errorShownBy ? { errorShownBy } : undefined,
  })
  await observer.mutate().catch(() => {})
}

describe('сбой мутации: кто сообщает человеку', () => {
  let consoleError: MockInstance<any[], void>

  beforeEach(() => {
    toastError.mockReset()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => consoleError.mockRestore())

  it('место вызова сообщает само — общий тост молчит', async () => {
    await failWith('caller')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('сбой не событие для человека — тоста нет', async () => {
    await failWith('nobody')
    expect(toastError).not.toHaveBeenCalled()
  })

  // Мутация, о сбое которой забыли сообщить, не проваливается молча.
  it('не сказано, кто сообщает, — общий тост, один и на языке человека', async () => {
    await failWith()
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Une erreur est survenue. Veuillez réessayer plus tard.')
  })

  it('в консоль сбой уходит всегда — тому, кто чинит', async () => {
    await failWith('caller')
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }))
  })
})
