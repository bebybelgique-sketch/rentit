// src/lib/authRedirect.ts
//
// Что пришло в адресе от ссылки из письма Supabase — прочитанное ДО того,
// как auth-js его разберёт и сотрёт (`window.location.hash = ''`).
//
// ЗАЧЕМ. Страница нового пароля ждала одного события — PASSWORD_RECOVERY —
// и не знала про его отсутствие. По исходнику auth-js 2.100.0:
//   • ссылка с ошибкой (просрочена, уже открыта почтовым сканером, открыта
//     второй раз) — `_initialize` возвращает ошибку и события НЕ шлёт;
//   • годная ссылка — событие уходит через setTimeout после сетевой
//     проверки, а страница грузится лениво и может подписаться ПОЗЖЕ.
// В обоих случаях человек навсегда видел «Vérification du lien…» — на
// единственной дороге назад в учётку.
//
// Модуль импортирует src/lib/supabase.ts первым, поэтому адрес читается до
// createClient — пока хеш ещё на месте.

export interface AuthRedirect {
  /** access_token из ссылки восстановления пароля (type=recovery), иначе null. */
  readonly recoveryToken: string | null
  /** Код ошибки, с которой Supabase вернул на сайт, иначе null. */
  readonly error: string | null
}

const NONE: AuthRedirect = { recoveryToken: null, error: null }

/** Разбор как у auth-js (helpers.parseParametersFromURL): хеш, потом строка запроса. */
export function parseAuthRedirect(href: string): AuthRedirect {
  let url: URL
  try { url = new URL(href) } catch { return NONE }
  const params = new Map<string, string>()
  if (url.hash.startsWith('#')) {
    new URLSearchParams(url.hash.slice(1)).forEach((v, k) => params.set(k, v))
  }
  url.searchParams.forEach((v, k) => params.set(k, v))

  const error = params.get('error_code') ?? params.get('error')
    ?? (params.get('error_description') ? 'unspecified_error' : null)
  const recoveryToken = params.get('type') === 'recovery' ? params.get('access_token') ?? null : null
  return { recoveryToken, error }
}

export const authRedirect: AuthRedirect =
  typeof window === 'undefined' ? NONE : parseAuthRedirect(window.location.href)
