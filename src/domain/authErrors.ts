// src/domain/authErrors.ts
//
// Отказы входа, регистрации и смены доступов — на языке человека.
//
// ── ЧТО БЫЛО ─────────────────────────────────────────────────────────
//
// Шесть экранов показывали `error.message` от Supabase КАК ЕСТЬ. На
// французской странице регистрации человек читал «User already
// registered»; на смене пароля — «New password should be different from
// the old password.»; голландец получал то же самое.
//
// Один экран, вход, имел собственный переводчик — и тот разбирал ровно
// ОДИН случай, а в остальных возвращал английский текст. То есть класс
// был найден, исправлен на одном экземпляре и там же оставлен.
//
// ── ПОЧЕМУ ПО КОДУ, А НЕ ПО ТЕКСТУ ───────────────────────────────────
//
// supabase-js отдаёт `error.code` (AuthError.code) — `user_already_exists`,
// `invalid_credentials`, `weak_password` и так далее. Разбор по ТЕКСТУ,
// как это делал вход, ломается от любой правки формулировки на стороне
// Supabase: «not confirmed» однажды станет «unconfirmed», и переводчик
// молча начнёт показывать английский. Код же — часть договора.
//
// Текст оставлен ЗАПАСНЫМ путём: у части ошибок кода нет (сетевые, старые
// сборки), и лучше узнать случай по фразе, чем показать общий текст.
//
// ── ПОЧЕМУ ЗДЕСЬ, А НЕ В serverErrors.ts ─────────────────────────────
//
// Там договор с НАШИМИ edge-функциями: мы сами решаем, какие коды слать.
// Здесь чужой словарь, который мы не выбираем и не контролируем, и
// смешивать их — значит однажды не понять, чей код перестал приходить.

/** Коды Supabase, о которых интерфейс знает, и их ключи в словарях. */
export const AUTH_ERROR_KEYS = {
  // Регистрация
  user_already_exists: 'authErrors.user_already_exists',
  email_exists: 'authErrors.user_already_exists',
  phone_exists: 'authErrors.phone_exists',
  signup_disabled: 'authErrors.signup_disabled',
  weak_password: 'authErrors.weak_password',

  // Вход
  invalid_credentials: 'authErrors.invalid_credentials',
  // Ключ НЕ новый: строка про неподтверждённую почту в продукте уже
  // была, и она лучше — говорит, что сделать, а не только
  // констатирует. Заводить рядом вторую про то же самое значило бы
  // развести их при первой правке одной из двух.
  email_not_confirmed: 'auth.login.emailNotConfirmed',
  phone_not_confirmed: 'auth.login.emailNotConfirmed',
  user_banned: 'authErrors.user_banned',
  user_not_found: 'authErrors.invalid_credentials',

  // Смена пароля и почты
  same_password: 'authErrors.same_password',
  reauthentication_needed: 'authErrors.reauthentication_needed',

  // Ссылка из письма
  otp_expired: 'authErrors.otp_expired',
  session_expired: 'authErrors.session_expired',
  flow_state_expired: 'authErrors.otp_expired',
  bad_jwt: 'authErrors.session_expired',

  // Слишком часто
  over_request_rate_limit: 'authErrors.rate_limited',
  over_email_send_rate_limit: 'authErrors.rate_limited',
  over_sms_send_rate_limit: 'authErrors.rate_limited',

  validation_failed: 'authErrors.validation_failed',
  email_address_invalid: 'authErrors.email_invalid',
  email_address_not_authorized: 'authErrors.email_invalid',
} as const satisfies Record<string, string>

export type AuthErrorCode = keyof typeof AUTH_ERROR_KEYS

/** Запасной ключ: он уже есть в словарях и используется по всему продукту. */
export const GENERIC_AUTH_ERROR_KEY = 'errors.generic'

/**
 * Узнавание по фразе — ЗАПАСНОЙ путь, не основной.
 *
 * Нужен там, где кода нет: у части ошибок он не приходит вовсе. Список
 * короткий намеренно: каждая строка здесь — ставка на чужую
 * формулировку, и чем их больше, тем чаще ставка проигрывает молча.
 */
const BY_PHRASE: ReadonlyArray<readonly [RegExp, string]> = [
  [/already registered|already exists/i, 'authErrors.user_already_exists'],
  [/invalid login credentials/i, 'authErrors.invalid_credentials'],
  [/not confirmed|confirm your email/i, 'auth.login.emailNotConfirmed'],
  [/should be different from the old password/i, 'authErrors.same_password'],
  [/password should be at least|weak password|too weak/i, 'authErrors.weak_password'],
  [/email address is invalid|invalid email/i, 'authErrors.email_invalid'],
  [/rate limit|too many requests/i, 'authErrors.rate_limited'],
  [/expired|invalid token/i, 'authErrors.otp_expired'],
  [/failed to fetch|network/i, 'serverErrors.network'],
]

/** Что пришло от supabase-js: код и текст бывают по отдельности. */
export interface AuthLikeError {
  readonly code?: string
  readonly message?: string
}

/**
 * Ключ словаря по ошибке Supabase.
 *
 * Незнакомый случай даёт ОБЩИЙ текст, а не английскую фразу: служебное
 * сообщение чужой системы человеку не поможет, а доверия к продукту
 * стоит. Сама фраза остаётся в объекте ошибки и в консоли — тому, кто
 * чинит, она достаётся целиком.
 */
export function authErrorKey(error: AuthLikeError | null | undefined): string {
  if (!error) return GENERIC_AUTH_ERROR_KEY

  const byCode = error.code && AUTH_ERROR_KEYS[error.code as AuthErrorCode]
  if (byCode) return byCode

  if (error.message) {
    for (const [pattern, key] of BY_PHRASE) {
      if (pattern.test(error.message)) return key
    }
  }

  return GENERIC_AUTH_ERROR_KEY
}
