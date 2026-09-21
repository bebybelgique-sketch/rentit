import { describe, it, expect } from 'vitest'
import { findUnused, countScanned, stripComments } from '../../scripts/check-unused-public.mjs'

/**
 * Мёртвый груз в public/.
 *
 * ЗАЧЕМ В НАБОРЕ, А НЕ ТОЛЬКО ОТДЕЛЬНОЙ КОМАНДОЙ. Проверка, живущая вне
 * прогона, однажды перестаёт запускаться — и никто этого не замечает,
 * потому что она не краснеет, а просто молчит.
 *
 * НАХОДКА, РАДИ КОТОРОЙ ЗАВЕДЕНО: иконка на 921 КБ, лежавшая в public/
 * с первого снимка репозитория (10.08) и уезжавшая в каждую сборку.
 * Ссылок на неё не было ни одной. Vite копирует public/ целиком, не
 * спрашивая, нужен ли файл, — ни ошибки, ни предупреждения.
 */
describe('мёртвый груз в public/', () => {
  it('обход вообще что-то видит', () => {
    // Ноль просмотренных означал бы, что проверка зелёная от слепоты.
    expect(countScanned()).toBeGreaterThan(5)
  })

  it('на каждый файл кто-то ссылается', () => {
    const unused = findUnused()
    expect(
      unused,
      `на эти файлы не ссылается ничто — убрать или начать использовать:\n  ${unused.join('\n  ')}`,
    ).toEqual([])
  })

  it('комментарии ссылкой не считаются', () => {
    // Ровно на этом первая версия сторожа объявила «чисто» при живом
    // файле: упоминание нашлось в её собственной шапке.
    expect(stripComments('// был файл old.png\nconst a = 1')).not.toContain('old.png')
    expect(stripComments('/* old.png */ const a = 1')).not.toContain('old.png')
    expect(stripComments('<!-- old.png -->')).not.toContain('old.png')
    // А живой код — считается.
    expect(stripComments("const src = '/icons/real.png'")).toContain('real.png')
  })
})
