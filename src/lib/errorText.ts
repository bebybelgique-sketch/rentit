// src/lib/errorText.ts
//
// ЧТО ПОКАЗАТЬ ЧЕЛОВЕКУ, КОГДА ЧТО-ТО НЕ ВЫШЛО. Одно место на весь
// интерфейс.
//
// ── ЗАЧЕМ ────────────────────────────────────────────────────────────
//
// До 23.09 девятнадцать мест в интерфейсе показывали `error.message` как
// есть. А это чужой текст:
//
//   • supabase-js — «Edge Function returned a non-2xx status code» вместо
//     «эти даты уже заняты» (ровно так отвечала заявка на аренду);
//   • PostgREST и Storage — «new row violates row-level security policy»,
//     «The object exceeded the maximum allowed size»;
//   • наши же хуки — по-французски для всех: «Photo trop lourde»
//     голландец читал на французском, хотя перевод в словаре БЫЛ.
//
// И обратный случай в том же классе: EditItem бросал переведённую
// подсказку («укажите цену доставки»), а ловил её общим «ошибка при
// обновлении» — человек не узнавал, что исправить.
//
// ── ПРАВИЛО ─────────────────────────────────────────────────────────
//
// Текст ошибки показывается, ТОЛЬКО если его писали для человека:
//
//   UserFacingError — наш текст, уже переведённый. Показать как есть.
//   EdgeError       — код нашей функции. Текст — из словаря по коду.
//   ошибка входа    — через authErrorKey (свои коды Supabase Auth).
//   нет сети        — «проверьте соединение», а не «что-то сломалось»:
//                     совет человеку разный.
//   всё остальное   — запасной текст ЭКРАНА. Сама фраза остаётся в
//                     консоли — тому, кто чинит, она достаётся целиком.
//
// Сторож: src/__tests__/rawErrorText.test.ts не пускает `.message` на
// экран мимо этого файла.

import type { TFunction } from 'i18next'
import { EdgeError } from './edgeInvoke'
import { SERVER_ERROR_KEYS, type ServerErrorCode } from '../domain/serverErrors'
import { authErrorKey, GENERIC_AUTH_ERROR_KEY } from '../domain/authErrors'

/** Ошибка, чей текст уже переведён и написан для человека. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

/** Отказ сети выглядит в разных браузерах и библиотеках по-разному. */
const NETWORK = /failed to fetch|networkerror|network request failed|load failed|internet connection/i

const messageOf = (error: unknown): string =>
  error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : ''

const isAuthError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (
    (error as { __isAuthError?: unknown }).__isAuthError === true ||
    /^Auth/.test(String((error as { name?: unknown }).name ?? ''))
  ))

/** Текст для экрана. `fallbackKey` — что сказать, если сказать точнее нечего. */
export function errorText(t: TFunction, error: unknown, fallbackKey: string): string {
  if (error instanceof UserFacingError) return error.message

  if (error instanceof EdgeError) {
    const key = SERVER_ERROR_KEYS[error.code as ServerErrorCode]
    // Незнакомый код — не повод показать общий «что-то сломалось», когда
    // у экрана есть свой, более точный запасной текст.
    return t(key && key !== SERVER_ERROR_KEYS.internal_error ? key : fallbackKey)
  }

  if (NETWORK.test(messageOf(error))) return t('serverErrors.network')

  if (isAuthError(error)) {
    const key = authErrorKey(error as { code?: string; message?: string })
    return t(key === GENERIC_AUTH_ERROR_KEY ? fallbackKey : key)
  }

  return t(fallbackKey)
}
