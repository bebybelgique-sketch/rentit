// Храповик против мёртвого груза в public/.
//
// ЗАЧЕМ. 22.09.2026 в public/icons/ нашёлся файл иконки весом 924 КБ, на
// который не ссылается НИЧТО. Он лежал там с первого снимка репозитория
// (10.08) и уезжал в каждую сборку — то есть весил больше, чем весь
// остальной public/ вместе взятый, и не показывался ни разу.
//
// Заметить такое нельзя ни глазами, ни сборкой: Vite копирует public/
// целиком, не спрашивая, нужен ли файл. Ошибки нет, предупреждения нет,
// просто лишний мегабайт в каждом деплое.
//
// ЧТО СЧИТАЕТСЯ ССЫЛКОЙ. Упоминание ИМЕНИ файла в исходниках, в
// index.html, в манифесте или в стилях. По имени, а не по полному пути:
// путь могут собрать из кусков, имя — почти никогда.
//
// ПОЧЕМУ СПИСОК ОЖИДАЕМОГО, А НЕ ЗАПРЕТ. Часть файлов по определению не
// может быть упомянута в коде: их запрашивает не продукт, а браузер или
// поисковик по фиксированному адресу. Такие перечислены поимённо, с
// причиной.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const selfPath = fileURLToPath(import.meta.url)

/**
 * Файлы, которых в коде нет и не должно быть.
 *
 * Их запрашивает не продукт: браузер и поисковик ходят по фиксированным
 * адресам, а часть собирается на сборке.
 */
const EXPECTED = new Map([
  ['manifest.json', 'браузер читает его по ссылке из index.html'],
  ['sw.js', 'собирается из src/sw.template.js плагином'],
  ['robots.txt', 'собирается на сборке из routeIndexing'],
  ['sitemap.xml', 'то же'],
  ['hero-tools.txt', 'лицензия на снимок, лежит рядом с ним'],
])

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/')

/** Где ищем упоминания. */
const SOURCES = ['src', 'scripts', 'supabase/functions']

/**
 * Комментарии гасятся, и себя сторож не читает.
 *
 * Первая версия объявила «мёртвого груза в public/ нет» при живом файле
 * на 924 КБ: упоминание нашлось в ШАПКЕ ЭТОГО ЖЕ ФАЙЛА, где оно
 * приведено как пример находки. Сторож, который не может сработать,
 * хуже отсутствующего — он выдаёт разрешение, которого не проверял.
 *
 * В остальных файлах комментарии гасятся по той же причине: запись
 * «раньше здесь лежал такой-то файл» — это причина удаления, а не
 * ссылка на него.
 */
export const stripComments = (source) => String(source)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/[^\n]*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '')

const haystack = () => {
  const files = [
    join(root, 'index.html'),
    ...SOURCES.flatMap((d) => walk(join(root, d))),
  ]
    .filter((f) => /\.(tsx?|jsx?|mjs|css|html|json)$/.test(f))
    .filter((f) => f !== selfPath)

  return files.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n')
}

export const findUnused = () => {
  const text = haystack()
  return walk(join(root, 'public'))
    .map(rel)
    .filter((p) => !EXPECTED.has(basename(p)))
    .filter((p) => !text.includes(basename(p)))
    .sort()
}

/** Сколько файлов просмотрено. Ноль = обход сломан. */
export const countScanned = () => walk(join(root, 'public')).length

const sizeOf = (p) => statSync(join(root, p)).size

if (selfPath === process.argv[1]) {
  const unused = findUnused()

  if (unused.length === 0) {
    console.log(`просмотрено файлов: ${countScanned()} — мёртвого груза в public/ нет`)
    process.exit(0)
  }

  const total = unused.reduce((s, p) => s + sizeOf(p), 0)
  console.log('НА ЭТИ ФАЙЛЫ НЕ ССЫЛАЕТСЯ НИЧТО:')
  for (const p of unused) {
    console.log(`  ${p} — ${(sizeOf(p) / 1024).toFixed(0)} КБ`)
  }
  console.log(`\nвсего лишнего: ${(total / 1024).toFixed(0)} КБ в каждой сборке`)
  console.log('Либо на файл начинают ссылаться, либо его убирают.')
  console.log('Если его запрашивает браузер по фиксированному адресу —')
  console.log('впишите его в EXPECTED в этом файле, С ПРИЧИНОЙ.')
  process.exit(1)
}
