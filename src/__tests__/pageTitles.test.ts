import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * У каждого экрана свой заголовок вкладки.
 *
 * ЗАЧЕМ СТОРОЖ, А НЕ ПРОСТО ПРАВКА. Заголовок — из тех вещей, которых не
 * видно, пока не понадобятся. До 21.09 он был ОДИН на весь продукт:
 * «RentIt — Location d'outils…» стоял и на витрине, и в кабинете, и на
 * странице конкретной вещи. Никто не жаловался, потому что жаловаться
 * не на что: экран выглядит правильно. Заметно это становится в семи
 * открытых вкладках, в истории браузера и в программе чтения с экрана,
 * которая объявляет название документа при каждом переходе.
 *
 * Ровно поэтому одной правки мало: следующий экран добавят через месяц
 * и про заголовок не вспомнят — напоминать будет некому. Здесь
 * напоминает набор.
 */

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const appTsx = read('src/App.tsx')

/**
 * Экран → файл, который его рисует.
 *
 * Берётся из `<Route … element={<X />}>`: обёртку `RequireAuth`
 * разворачиваем, потому что заголовок ставит сам экран, а не сторож
 * входа.
 */
const routeComponents = (): Array<[string, string]> =>
  [...appTsx.matchAll(/<Route\s+path="([^"]+)"\s+element=\{(.+?)\}\s*\/>/gs)]
    .map(([, path, element]) => {
      const names = [...element.matchAll(/<([A-Z]\w*)/g)].map(([, n]) => n)
      // Последний компонент в цепочке и есть экран:
      // `<RequireAuth><MyItems /></RequireAuth>` → MyItems.
      return [path, names[names.length - 1]] as [string, string]
    })
    .filter(([, name]) => Boolean(name))

describe('заголовок вкладки', () => {
  const components = routeComponents()

  it('разбор видит маршруты и их экраны', () => {
    expect(components.length).toBeGreaterThan(10)
    expect(components.find(([p]) => p === '/my-items')?.[1]).toBe('MyItems')
  })

  it.each(components)('%s (%s) ставит заголовок', (_path, name) => {
    // Экран живёт либо своим файлом в pages/, либо прямо в App.tsx
    // (так сделан перехват 404 — ради одного хука выносить его в
    // отдельный файл было бы больше кода, чем пользы).
    const file = join(root, 'src', 'pages', `${name}.tsx`)
    const source = existsSync(file) ? readFileSync(file, 'utf8') : appTsx

    const sets = source.includes('usePageTitle(') || source.includes('useDefaultPageTitle(')
    expect(
      sets,
      `${name} не ставит заголовок вкладки.\n` +
        `Вызовите usePageTitle(t('…')) в теле компонента — или\n` +
        `useDefaultPageTitle(), если экран намеренно оставляет заголовок из index.html.`,
    ).toBe(true)
  })
})

describe('заголовки берутся из словарей', () => {
  const pages = routeComponents()
    .map(([, name]) => name)
    .filter((name) => existsSync(join(root, 'src', 'pages', `${name}.tsx`)))

  /**
   * Никаких литералов в вызове.
   *
   * Строка, вшитая сюда, не переводится ничем: словари её не видят, и
   * голландец получил бы французскую вкладку. Исключение — выражение из
   * данных (`item?.title`): название вещи пишет владелец, и переводить
   * его нечем и незачем.
   */
  it.each(pages)('%s: заголовок не вшит строкой', (name) => {
    const source = readFileSync(join(root, 'src', 'pages', `${name}.tsx`), 'utf8')
    const calls = [...source.matchAll(/usePageTitle\(([^)]*(?:\)[^)]*)?)\)/g)].map(([, arg]) => arg.trim())
    const literal = calls.filter((arg) => /^['"`]/.test(arg))
    expect(literal, `заголовок вшит строкой: ${literal.join(', ')}`).toEqual([])
  })
})

describe('словари знают все ключи заголовков', () => {
  const langs = ['fr', 'nl', 'en'] as const
  const dicts = Object.fromEntries(
    langs.map((l) => [l, JSON.parse(read(`src/locales/${l}.json`))]),
  ) as Record<string, Record<string, unknown>>

  const lookup = (dict: Record<string, unknown>, key: string): unknown =>
    key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict)

  /** Ключи, которыми экраны зовут заголовок. */
  const usedKeys = (): string[] => {
    const files = ['src/App.tsx', ...routeComponents()
      .map(([, n]) => `src/pages/${n}.tsx`)
      .filter((p) => existsSync(join(root, p)))]
    const keys = new Set<string>()
    for (const f of files) {
      for (const [, key] of readFileSync(join(root, f), 'utf8').matchAll(/usePageTitle\(\s*t\('([^']+)'\)/g)) {
        keys.add(key)
      }
    }
    return [...keys].sort()
  }

  it('ключи вообще нашлись', () => {
    expect(usedKeys().length).toBeGreaterThanOrEqual(12)
  })

  it.each(langs)('%s: каждый ключ на месте и это строка', (lang) => {
    // Не «ключ есть», а именно СТРОКА: i18next на пространство имён
    // печатает «returned an object instead of string», и это уже висело
    // в проде у каждого вошедшего.
    const missing = usedKeys().filter((k) => typeof lookup(dicts[lang], k) !== 'string')
    expect(missing, `нет в ${lang}.json:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('переводы не совпадают дословно между языками', () => {
    // Совпадение слово в слово — обычно признак того, что строку
    // скопировали и забыли перевести. Имена собственные исключены.
    const suspicious = usedKeys().filter((k) => {
      const fr = lookup(dicts.fr, k)
      const nl = lookup(dicts.nl, k)
      return typeof fr === 'string' && fr === nl && !/^[A-Z][a-z]+$/.test(fr)
    })
    expect(suspicious, `fr и nl совпадают дословно:\n  ${suspicious.join('\n  ')}`).toEqual([])
  })
})
