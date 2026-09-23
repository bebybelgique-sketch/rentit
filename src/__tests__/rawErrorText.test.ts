import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Сторож: `.message` чужой ошибки не попадает на экран.
 *
 * 23.09 таких мест нашлось девятнадцать — `setError(err.message)`,
 * `toast.error(error.message || …)`, `<p>Erreur: {error.message}</p>`. Через
 * них человек читал «Edge Function returned a non-2xx status code», фразы
 * PostgREST и французский текст на нидерландской странице.
 *
 * Правильный путь один — src/lib/errorText.ts: наш переведённый текст
 * (UserFacingError) показывается как есть, код функции — через словарь,
 * всё прочее — запасной текст экрана.
 *
 * Что сторож запрещает — места, где текст УХОДИТ НА ЭКРАН:
 *   • `.message ||` / `.message ??` — «чужой текст, а если нет — наш»;
 *   • `.message` внутри setError / setLocalError / toast / alert;
 *   • `{….message}` в разметке и `error={….message}` в свойствах;
 *   • UserFacingError со строкой вместо перевода — такой текст увидит
 *     человек на любом языке одинаковым.
 *
 * Что НЕ запрещено: `serverErrorKey(err.message)` — у EdgeError сообщение
 * и есть код; чтение `.message` для разбора и в журнал.
 */

const root = join(process.cwd(), 'src')
const SKIP = ['__tests__', `${join('src', 'test')}`]

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })

// `\.message\b` — граница слова: ключ 'booking.messageSendFailed' не текст ошибки.
// `(?<!\$)` — `${err.message}` в шаблонной строке журнала не разметка.
// `(?<!props)` — свойство компонента с именем message несёт уже переведённый текст.
const SINKS: RegExp[] = [
  /\.message\b\s*(\|\||\?\?)/,
  /\bset\w*Error\([^)]*(?<!props)\.message\b/,
  /\btoast\.\w+\([^)]*(?<!props)\.message\b/,
  /\balert\([^)]*\.message\b/,
  /(?<!\$)\{[^{}]*(?<!props)\.message\b\s*\}/,
  /\berror=\{[^}]*\.message\b/,
  /new UserFacingError\(\s*['"]/,
]

/**
 * Модули, которые ЧИТАЮТ текст ошибок для разбора и журнала, а не для
 * экрана человека.
 *
 * AdminErrors.tsx — вкладка «Erreurs» в /admin: её предмет и есть текст
 * поломки, показанный тому, кто её чинит. Это не экран пользователя, и
 * запасной «что-то пошло не так» там лишил бы вкладку смысла.
 */
const READERS = ['errorText.ts', 'errorLog.ts', 'authErrors.ts', 'AdminErrors.tsx']

export function findSinks(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
    .filter((line) => !/console\.(error|warn|log)\(/.test(line))
    .filter((line) => !line.includes('serverErrorKey('))
    .filter((line) => SINKS.some((re) => re.test(line)))
}

describe('текст чужой ошибки не уходит на экран', () => {
  it('в src нет ни одного такого места', () => {
    const offenders = walk(root)
      .filter((file) => !SKIP.some((s) => file.includes(s)))
      .filter((file) => !READERS.some((r) => file.endsWith(r)))
      .flatMap((file) => findSinks(readFileSync(file, 'utf8')).map((line) => `${relative(root, file)}: ${line}`))
    expect(offenders).toEqual([])
  })

  it('сторож видит то, ради чего написан', () => {
    expect(findSinks(`setError(err.message || t('itemDetail.requestError'))`)).toHaveLength(1)
    expect(findSinks(`toast.error(error.message || t('profile.updateError'));`)).toHaveLength(1)
    expect(findSinks(`{userRentalsError && <p>Erreur: {userRentalsError.message}</p>}`)).toHaveLength(1)
    expect(findSinks(`error={createReview.isError ? createReview.error.message : null}`)).toHaveLength(1)
    expect(findSinks(`const actionError = setAvailability.error?.message ?? ''`)).toHaveLength(1)
    expect(findSinks(`if (err) return setError(err.message)`)).toHaveLength(1)
    expect(findSinks(`throw new UserFacingError('Photo trop lourde')`)).toHaveLength(1)
    // Разрешённое:
    expect(findSinks(`setError(errorText(t, err, 'itemDetail.requestError'))`)).toEqual([])
    expect(findSinks(`toast.error(t(serverErrorKey(error instanceof Error ? error.message : null)));`)).toEqual([])
    expect(findSinks(`console.error('[avatar] загрузка:', upErr.message);`)).toEqual([])
    expect(findSinks(`throw new UserFacingError(i18n.t('booking.photoTooLarge'));`)).toEqual([])
    expect(findSinks(`setLocalError(errorText(t, err, 'booking.messageSendFailed'));`)).toEqual([])
    expect(findSinks('const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)')).toEqual([])
    expect(findSinks(`{this.props.message}`)).toEqual([])
    // Шаблон, собранный из перевода, — законный текст для человека.
    expect(findSinks('throw new UserFacingError(`${label} ${t(\'listItem.priceMustBePositive\')}`)')).toEqual([])
  })
})
