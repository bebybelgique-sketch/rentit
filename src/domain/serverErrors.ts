// src/domain/serverErrors.ts
//
// Договор об отказах между сервером и интерфейсом.
//
// Сервер отдаёт КОД: `{ "error": "dates_unavailable" }`. Текст подбирает
// клиент — у него есть выбранный человеком язык, у функции его нет.
//
// ЗАЧЕМ ТАК. До 05.09 edge-функции отвечали фразами, и фразы были на двух
// языках сразу: 'Forbidden' рядом с 'La réservation a changé entre-temps'.
// Клиент показывал их как есть, поэтому голландец получал отказ
// по-французски, а француз — по-английски, и ни один из них не мог быть
// исправлен переводчиком: строки жили в Deno-функциях, куда словари не
// заглядывают.
//
// ПОЧЕМУ ОДНО ПРОСТРАНСТВО `serverErrors`, А НЕ `admin.errors` РЯДОМ С
// `rental.errors`. Коды `forbidden`, `update_failed`, `bad_request` общие
// для всех функций. Разложив их по экранам, мы бы завели два перевода
// одного отказа, и они разошлись бы — ровно так уже разъезжались подписи
// статусов между /my-items и бейджем.
//
// ПОЧЕМУ КАРТА, А НЕ `t('serverErrors.' + code)` НА МЕСТЕ. Страж словарей
// (scripts/check-i18n-keys.mjs) видит только литеральные `t('...')`;
// ключ, собранный из переменной, для него не существует. Ключи, собранные
// здесь литералами, проверяются тестом рядом — иначе первый же
// непереведённый код показал бы человеку служебное слово вместо фразы.

/** Коды, о которых знает интерфейс, и их ключи в словарях. */
export const SERVER_ERROR_KEYS = {
  // Общие
  unauthorized: 'serverErrors.unauthorized',
  forbidden: 'serverErrors.forbidden',
  bad_request: 'serverErrors.bad_request',
  update_failed: 'serverErrors.update_failed',
  internal_error: 'serverErrors.internal_error',
  method_not_allowed: 'serverErrors.internal_error',

  // Бронь: respond-to-request и transition-booking
  booking_not_found: 'serverErrors.booking_not_found',
  item_not_found: 'serverErrors.item_not_found',
  not_pending: 'serverErrors.not_pending',
  booking_changed: 'serverErrors.booking_changed',
  dates_unavailable: 'serverErrors.dates_unavailable',
  transition_not_allowed: 'serverErrors.transition_not_allowed',
  not_your_action: 'serverErrors.not_your_action',

  // Админка: admin-action
  cannot_demote_self: 'serverErrors.cannot_demote_self',
  target_not_found: 'serverErrors.target_not_found',
} as const satisfies Record<string, string>;

export type ServerErrorCode = keyof typeof SERVER_ERROR_KEYS;

/** Запасной ключ: он уже есть в словарях и используется по всему продукту. */
export const GENERIC_ERROR_KEY = 'errors.generic';

/**
 * Ключ словаря по коду сервера.
 *
 * Неизвестный код — это не повод показать человеку `undefined` или сырое
 * слово из кода функции: незнакомое имя ошибки для него бессмысленно.
 * Отдаём общий текст, а сам код остаётся в исключении и в консоли.
 */
export function serverErrorKey(code: string | null | undefined): string {
  if (!code) return GENERIC_ERROR_KEY;
  return SERVER_ERROR_KEYS[code as ServerErrorCode] ?? GENERIC_ERROR_KEY;
}
