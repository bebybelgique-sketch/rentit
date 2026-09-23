import { describe, it, expect, vi } from 'vitest'
import i18n from 'i18next'

vi.mock('../supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

import { errorText, UserFacingError } from '../errorText'
import { EdgeError } from '../edgeInvoke'

/**
 * Что видит человек при каждом виде отказа. Французская локаль поднята
 * в src/test/setup.ts — строки ниже те же, что на экране.
 */

const t = i18n.t.bind(i18n)
const FALLBACK = 'itemDetail.requestError'

describe('errorText', () => {
  it('наш переведённый текст — как есть', () => {
    expect(errorText(t, new UserFacingError('Indiquez le prix de livraison.'), FALLBACK)).toBe('Indiquez le prix de livraison.')
  })

  it('код функции — фраза из словаря, а не «non-2xx status code»', () => {
    expect(errorText(t, new EdgeError('duplicate_request', 409), FALLBACK))
      .toBe('Vous avez déjà une demande en attente pour ces dates.')
    expect(errorText(t, new EdgeError('dates_unavailable', 409), FALLBACK)).toBe('Ces dates ne sont plus disponibles.')
    expect(errorText(t, new EdgeError('unauthorized', 401), FALLBACK)).toBe('Session expirée. Reconnectez-vous.')
  })

  it('незнакомый код или «что-то сломалось» — запасной текст ЭКРАНА, он точнее', () => {
    expect(errorText(t, new EdgeError('something_new', 400), FALLBACK)).toBe("Erreur lors de l'envoi de la demande")
    expect(errorText(t, new EdgeError('internal_error', 500), FALLBACK)).toBe("Erreur lors de l'envoi de la demande")
  })

  it('нет сети — совет про соединение, откуда бы отказ ни пришёл', () => {
    expect(errorText(t, new EdgeError('network'), FALLBACK)).toBe('Pas de connexion. Vérifiez votre réseau et réessayez.')
    expect(errorText(t, new TypeError('Failed to fetch'), FALLBACK)).toBe('Pas de connexion. Vérifiez votre réseau et réessayez.')
    // PostgREST при обрыве отдаёт объект, а не исключение.
    expect(errorText(t, { message: 'TypeError: Failed to fetch', code: '' }, FALLBACK)).toBe('Pas de connexion. Vérifiez votre réseau et réessayez.')
  })

  it('отказ Supabase Auth — через его коды', () => {
    const authError = Object.assign(new Error('Email not confirmed'), { name: 'AuthApiError', code: 'email_not_confirmed', __isAuthError: true })
    expect(errorText(t, authError, FALLBACK)).not.toBe("Erreur lors de l'envoi de la demande")
    expect(errorText(t, authError, FALLBACK)).not.toMatch(/Email not confirmed/)
  })

  it('чужой текст на экран не попадает никогда', () => {
    for (const foreign of [
      new Error('Edge Function returned a non-2xx status code'),
      { message: 'new row violates row-level security policy for table "items"', code: '42501' },
      { name: 'StorageApiError', message: 'The object exceeded the maximum allowed size' },
      'просто строка',
      null,
      undefined,
    ]) {
      expect(errorText(t, foreign, FALLBACK)).toBe("Erreur lors de l'envoi de la demande")
    }
  })
})
