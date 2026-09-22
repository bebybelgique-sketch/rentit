import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { authErrorKey, AUTH_ERROR_KEYS, GENERIC_AUTH_ERROR_KEY } from '../domain/authErrors'

/**
 * Отказы Supabase не показываются человеку по-английски.
 *
 * ── ЧТО БЫЛО ─────────────────────────────────────────────────────────
 *
 * Шесть экранов печатали `error.message` как есть. На французской
 * странице регистрации человек читал «User already registered», на смене
 * пароля — «New password should be different from the old password.»;
 * голландец получал то же самое.
 *
 * Вход имел собственный переводчик — и тот разбирал РОВНО ОДИН случай, а
 * в остальных возвращал английский текст. Класс был найден, исправлен на
 * одном экземпляре и там же оставлен.
 */

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const langs = ['fr', 'nl', 'en'] as const
const dicts = Object.fromEntries(
  langs.map((l) => [l, JSON.parse(read(`src/locales/${l}.json`))]),
) as Record<string, unknown>

/**
 * Поиск по словарю на ЛЮБОЙ глубине.
 *
 * Первая версия делила ключ на две части и на `auth.login.emailNotConfirmed`
 * искала `auth["login.emailNotConfirmed"]` — то есть ничего. Ключи в
 * продукте бывают и двух-, и трёхуровневые.
 */
const lookup = (dict: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
    dict,
  )

describe('перевод отказа', () => {
  it('узнаёт случай по КОДУ', () => {
    expect(authErrorKey({ code: 'user_already_exists' })).toBe('authErrors.user_already_exists')
    expect(authErrorKey({ code: 'invalid_credentials' })).toBe('authErrors.invalid_credentials')
    expect(authErrorKey({ code: 'weak_password' })).toBe('authErrors.weak_password')
  })

  /**
   * Код важнее текста: разбор по фразе ломается от любой правки
   * формулировки на чужой стороне, и ломается МОЛЧА.
   */
  it('код важнее текста, когда есть оба', () => {
    expect(authErrorKey({ code: 'same_password', message: 'Invalid login credentials' }))
      .toBe('authErrors.same_password')
  })

  it('узнаёт по фразе, когда кода нет', () => {
    expect(authErrorKey({ message: 'User already registered' })).toBe('authErrors.user_already_exists')
    expect(authErrorKey({ message: 'Invalid login credentials' })).toBe('authErrors.invalid_credentials')
    expect(authErrorKey({ message: 'Failed to fetch' })).toBe('serverErrors.network')
  })

  /**
   * Служебная фраза чужой системы человеку не поможет, а доверия к
   * продукту стоит. Сама фраза остаётся в объекте ошибки и в консоли.
   */
  it('незнакомый случай даёт общий текст, а не английскую фразу', () => {
    expect(authErrorKey({ code: 'какой_то_новый_код' })).toBe(GENERIC_AUTH_ERROR_KEY)
    expect(authErrorKey({ message: 'Something unusual happened on the server' }))
      .toBe(GENERIC_AUTH_ERROR_KEY)
    expect(authErrorKey(null)).toBe(GENERIC_AUTH_ERROR_KEY)
    expect(authErrorKey(undefined)).toBe(GENERIC_AUTH_ERROR_KEY)
  })

  it('коды Supabase, о которых мы знаем, действительно существуют в библиотеке', () => {
    // Ставка на чужой словарь проверяется по самому словарю: опечатка в
    // коде означала бы, что случай не узнаётся НИКОГДА, и заметить это
    // можно было бы только по жалобе.
    const codes = read('node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts')
    const unknown = Object.keys(AUTH_ERROR_KEYS).filter((c) => !codes.includes(`'${c}'`))
    expect(
      unknown,
      `таких кодов в @supabase/auth-js нет — опечатка или код убрали:\n  ${unknown.join('\n  ')}`,
    ).toEqual([])
  })
})

describe('словари знают все ключи отказов', () => {
  const keys = [...new Set(Object.values(AUTH_ERROR_KEYS))]

  it.each(langs)('%s: каждый ключ на месте и это строка', (lang) => {
    const missing = keys.filter((k) => typeof lookup(dicts[lang], k) !== 'string')
    expect(missing, `нет в ${lang}.json:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('переводы не совпадают дословно между fr и nl', () => {
    // Совпадение слово в слово — обычно признак копии без перевода.
    const same = keys.filter((k) => {
      const fr = lookup(dicts.fr, k)
      return typeof fr === 'string' && fr === lookup(dicts.nl, k)
    })
    expect(same, `fr и nl совпадают дословно:\n  ${same.join('\n  ')}`).toEqual([])
  })
})

/**
 * Экраны доступа не печатают сырое сообщение.
 *
 * Проверка по исходникам, а не по отрисовке: чтобы увидеть это в
 * браузере, нужно вызвать у Supabase каждый отказ поимённо — то есть
 * плодить учётки в проде. Признак же структурный и однозначный.
 */
describe('ни один экран доступа не показывает сырое сообщение', () => {
  const SCREENS = [
    'src/pages/Login.tsx',
    'src/pages/Register.tsx',
    'src/pages/ForgotPassword.tsx',
    'src/pages/ResetPassword.tsx',
    'src/components/common/ChangePassword.tsx',
    'src/components/common/ChangeEmail.tsx',
  ]

  it.each(SCREENS)('%s', (file) => {
    const source = read(file)
      // Комментарии гасятся: в них описано, ПОЧЕМУ так больше не делают.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/[^\n]*$/gm, '')

    // Ищем показ сообщения человеку: setError(...message) или toast(...message).
    const leaks = [...source.matchAll(/(setError|toast\.\w+)\(\s*[^)]*\.message/g)]
      .map(([m]) => m)

    expect(
      leaks,
      `сырое сообщение Supabase уходит на экран: ${leaks.join(', ')}\n` +
        `переведите через authErrorKey(error) — src/domain/authErrors.ts`,
    ).toEqual([])
  })

  it('каждый из этих экранов действительно зовёт переводчик', () => {
    // Иначе проверка выше проходила бы и на экране, где отказ вообще не
    // показывают — то есть молчит там, где человеку не сказали ничего.
    const without = SCREENS.filter((f) => !read(f).includes('authErrorKey'))
    expect(without, `переводчик не подключён:\n  ${without.join('\n  ')}`).toEqual([])
  })
})
