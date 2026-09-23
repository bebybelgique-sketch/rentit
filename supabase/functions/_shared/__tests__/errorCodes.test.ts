import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Сторож: edge-функции отказывают КОДАМИ, а не фразами.
 *
 * Договор с интерфейсом: сервер пишет `{ error: 'dates_unavailable' }`,
 * текст на языке человека подбирает клиент (src/domain/serverErrors.ts).
 * Фраза в ответе функции — это текст, который увидит человек, но который
 * не может перевести ни один переводчик: словари в функции не заглядывают.
 *
 * ПОЧЕМУ ЭТОТ ФАЙЛ ПОЯВИЛСЯ. Правило было заведено 05.09, но жило в
 * головах. 23.09 нашлось, что request-rental так и отвечал
 * «Cannot rent your own item», delete-account — французским текстом для
 * всех языков, а общий _shared/auth.ts — «Unauthorized: Invalid or
 * expired token», который три функции отдавали как есть.
 *
 * Правило, которого сторож требует:
 *   • строка в `error:` — только snake_case-код;
 *   • в `error:` не уходит `.message` чужой ошибки — это всегда фраза.
 */

const root = join(process.cwd(), 'supabase', 'functions')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
    return path.endsWith('.ts') ? [path] : []
  })

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')

const CODE = /^[a-z][a-z0-9_]*$/

export function findPhrases(source: string): string[] {
  const code = withoutComments(source)
  const found: string[] = []
  // Значение `error:` целиком — до запятой, скобки или конца строки, а не
  // только первый литерал: первая версия сторожа пропустила
  // `error: err instanceof Error ? err.message : 'Unexpected error'`.
  for (const m of code.matchAll(/\berror:\s*([^,}\n]+)/g)) {
    const value = m[1]
    if (/\.message\b/.test(value)) {
      found.push(value.trim())
      continue
    }
    for (const lit of value.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      if (!CODE.test(lit[2])) found.push(lit[2])
    }
  }
  return found
}

describe('отказы функций — кодами', () => {
  it('ни одной фразы в `error:`', () => {
    const offenders = walk(root).flatMap((file) =>
      findPhrases(readFileSync(file, 'utf8')).map((p) => `${relative(root, file)}: ${p}`))
    expect(offenders).toEqual([])
  })

  it('сторож видит то, ради чего написан', () => {
    expect(findPhrases(`return json({ error: 'Cannot rent your own item' }, 400)`)).toEqual(['Cannot rent your own item'])
    expect(findPhrases(`json({ error: deleteErr.message }, 500)`)).toEqual(['deleteErr.message'])
    expect(findPhrases(`json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)`)).toHaveLength(1)
    expect(findPhrases(`json({ error: ok ? 'fine_code' : 'Bad thing' })`)).toEqual(['Bad thing'])
    expect(findPhrases(`json({ error: 'Vous avez des réservations actives.' }, 409)`)).toHaveLength(1)
    expect(findPhrases(`json({ error: 'dates_unavailable', day }, 409)`)).toEqual([])
    // Разбор ответа базы — не ответ человеку.
    expect(findPhrases(`const { data, error: itemErr } = await supabase`)).toEqual([])
    // Комментарий с примером старой фразы — не нарушение.
    expect(findPhrases(`// было: { error: 'Missing fields' }`)).toEqual([])
  })
})
