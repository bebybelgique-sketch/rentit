import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Словари нидерландского и английского НЕ едут в главном куске.
 *
 * ── ЗАМЕР, С КОТОРОГО ВСЁ НАЧАЛОСЬ ───────────────────────────────────
 *
 *   fr: 38 КБ → 12.2 КБ сжатым
 *   nl: 37 КБ → 11.9 КБ сжатым
 *   en: 34 КБ → 11.1 КБ сжатым
 *
 * Все три лежали в index-*.js: ~23 КБ сжатыми, 13 % главного куска,
 * скачивал каждый — включая два языка, которых он не читает. Аудитория
 * приходит с телефона.
 *
 * После правки: 176 КБ → 156 КБ сжатым.
 *
 * ── ПОЧЕМУ ЭТО ЛЕГКО ВЕРНУТЬ ОБРАТНО ─────────────────────────────────
 *
 * Достаточно одной строки `import nl from './locales/nl.json'` где
 * угодно в графе входного модуля — и сборщик снова положит словарь в
 * главный кусок. Ни ошибки, ни предупреждения: продукт работает, просто
 * каждый снова платит за чужие языки. Заметить это можно только тем,
 * что смотреть на РЕЗУЛЬТАТ сборки.
 */

const root = process.cwd()
const dist = join(root, 'dist', 'assets')

/** Строка, которая есть только в этом языке. */
const marker = (lang: string): string => {
  const dict = JSON.parse(readFileSync(join(root, 'src', 'locales', `${lang}.json`), 'utf8'))
  return dict.authErrors.invalid_credentials
}

describe('раскладка словарей по кускам', () => {
  /**
   * Пропуск разрешён только на машине разработчика — в CI сборка обязана
   * идти перед тестами. Проверка, которую можно молча пропустить,
   * однажды будет молча пропущена: ровно так тест собранного воркера
   * ни разу не запустился в CI, пока сборка стояла после.
   */
  it('в CI сборка обязана существовать', () => {
    if (!process.env.CI) return
    expect(
      existsSync(dist),
      'dist/ нет: шаг «Сборка» обязан идти ПЕРЕД шагом «Юнит-тесты»',
    ).toBe(true)
  })

  const entry = () => {
    const name = readdirSync(dist).find((n) => /^index-.*\.js$/.test(n))
    if (!name) throw new Error('главный кусок не найден в dist/assets')
    return readFileSync(join(dist, name), 'utf8')
  }

  it.runIf(existsSync(dist))('французский в главном куске ОСТАЁТСЯ', () => {
    // Он основной язык продукта и запасной для остальных: без него
    // отсутствующий ключ показал бы сам ключ.
    expect(entry()).toContain(marker('fr'))
  })

  it.runIf(existsSync(dist))('нидерландского и английского в главном куске НЕТ', () => {
    const source = entry()
    const leaked = ['nl', 'en'].filter((l) => source.includes(marker(l)))
    expect(
      leaked,
      `словарь снова в главном куске: ${leaked.join(', ')}\n` +
        `ищите статический import из src/locales/ в графе входного модуля`,
    ).toEqual([])
  })

  it.runIf(existsSync(dist))('они лежат отдельными кусками — то есть догружаются', () => {
    // Иначе проверка выше проходила бы и в случае, когда словарь исчез
    // ВООБЩЕ: тогда голландец получал бы французский и никакой ошибки.
    const chunks = readdirSync(dist).filter((n) => /^(nl|en)-.*\.js$/.test(n))
    expect(chunks.length, `отдельных кусков словарей нет: ${chunks.join(', ')}`).toBe(2)
  })
})

describe('переключение языка подвозит словарь', () => {
  const i18n = readFileSync(join(root, 'src', 'i18n-next.ts'), 'utf8')
  const app = readFileSync(join(root, 'src', 'App.tsx'), 'utf8')

  it('загрузка идёт ДО переключения', () => {
    // `changeLanguage` применяется мгновенно, и пока словарь едет,
    // i18next отдаёт запасной — французский. Нидерландец, нажавший «NL»,
    // увидел бы вспышку французского и решил, что кнопка не работает.
    const at = i18n.indexOf('export async function setLanguage')
    expect(at).toBeGreaterThan(0)
    const body = i18n.slice(at, at + 400)
    expect(body.indexOf('loadLanguage')).toBeLessThan(body.indexOf('changeLanguage'))
  })

  it('переключатель зовёт setLanguage', () => {
    expect(app).toContain('setLanguage(')
  })

  /**
   * НИГДЕ В ПРОДУКТЕ нет прямого changeLanguage — не только в App.
   *
   * Первая версия этой проверки смотрела на один файл. Это ровно та
   * ошибка, которую я в тот же день чинил в чужом коде: класс найден,
   * закрыт на одном экземпляре и там оставлен. Прямой вызов из любого
   * места вернёт вспышку запасного языка — так и упал набор форм входа,
   * пока его помощник переключал язык мимо setLanguage.
   */
  it('прямого changeLanguage нет нигде в src', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])

    const callers = walk(join(root, 'src'))
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => !f.endsWith('i18n-next.ts'))
      .filter((f) => /\.changeLanguage\(/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length + 1).replace(/\\/g, '/'))

    expect(
      callers,
      `прямой changeLanguage вернёт вспышку запасного языка — зовите setLanguage:\n  ${callers.join('\n  ')}`,
    ).toEqual([])
  })

  it('первая отрисовка ждёт словарь', () => {
    const main = readFileSync(join(root, 'src', 'main.tsx'), 'utf8')
    expect(main).toContain('i18nReady')
    // Именно ЖДЁТ: отрисовка внутри then, а не рядом с ним. Якорь —
    // сам вызов, а не первое упоминание: первое приходится на строку
    // импорта, и проверка смотрела в комментарии под ней.
    const at = main.indexOf('i18nReady.then')
    expect(at, 'отрисовка не ждёт словарь').toBeGreaterThan(0)
    expect(main.slice(at, at + 400)).toContain('createRoot')
  })

  it('отказ загрузки не роняет приложение', () => {
    const at = i18n.indexOf('export async function loadLanguage')
    expect(i18n.slice(at, at + 700)).toMatch(/catch/)
  })
})
