// Храповик против снятой палитры.
//
// ЗАЧЕМ. 12.08 палитру сменили: лайм #ADFF2F на чёрном #080808 уступил
// чернилам, серебру, красному-действию и сигнальному жёлтому (см. шапку
// src/index.css). Замена прошла по переменным CSS — и не достала до тех
// мест, где цвет записан ИНЛАЙНОМ или внутри строкового шаблона.
//
// 19.09.2026, замер живого прода на телефоне, показал два таких места,
// проживших пять недель:
//
//   • CookieBanner — вторая половина имени «RentIt» лаймовая с чёрной
//     обводкой. Это ПЕРВЫЙ экран каждого посетителя: в шапке то же имя
//     жёлтое, в баннере зелёное, двести пикселей друг от друга;
//   • Home.tsx, всплывашка карты — кнопка «voir plus» лаймом на чёрном.
//     Причём соседняя метка цены в том же файле была перекрашена ещё
//     тогда, и рядом стоит комментарий, объясняющий почему. Правку
//     применили к десяти строкам и не довели до одиннадцатой.
//
// Оба невидимы для существующих сторожей: check-hardcoded-text ищет ТЕКСТ
// мимо словарей, а не цвета, и оба места — внутри style={{…}} и шаблонной
// строки, куда замена переменных не заглядывает.
//
// ЧТО СЧИТАЕТСЯ. Только живой код. Упоминания в комментариях — это ЗАПИСЬ
// о снятии («метка была лаймовой…»), и запрещать их значит стирать
// причину, по которой цвет ушёл. Комментарии снимаются до подсчёта тем же
// способом, что в check-db-access.
//
// ПОЧЕМУ ХРАПОВИК, А НЕ ЗАПРЕТ. #ADFF2F после 19.09 не осталось нигде —
// для него порог ноль. А #080808 живёт в 18 местах, и половина из них —
// CookieBanner, не переносившийся на новую палитру целиком. Перекрасить
// его заодно с багфиксом значило бы смешать две задачи; поэтому счёт
// заморожен и может только уменьшаться.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ALLOWLIST = join(root, 'scripts', 'retired-palette-allowlist.json')

/** Цвета снятой палитры и чем они заменены. */
export const RETIRED = {
  '#ADFF2F': 'лайм — заменён на var(--action) / var(--signal) по фону',
  '#080808': 'старый чёрный — заменён на var(--primary) #121417',
}

const SKIP = ['/__tests__/', '/test/']

/** Снять комментарии: они хранят причину снятия и запретом не считаются. */
export const stripComments = (source) => {
  const withoutBlocks = String(source).replace(/\/\*[\s\S]*?\*\//g, '')
  return withoutBlocks
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

/** Сколько снятых цветов в одном исходнике, по цветам. */
export const countInSource = (source) => {
  const code = stripComments(source)
  const out = {}
  for (const hex of Object.keys(RETIRED)) {
    const n = (code.match(new RegExp(hex, 'gi')) || []).length
    if (n > 0) out[hex] = n
  }
  return out
}

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/')

const scannedFiles = () => walk(join(root, 'src'))
  .filter((f) => /\.(ts|tsx|css)$/.test(f))
  .map(rel)
  .filter((p) => !SKIP.some((s) => `/${p}`.includes(s)))

/** Сколько файлов просмотрено. Ноль = обход сломан. */
export const countScannedFiles = () => scannedFiles().length

/** `путь → { '#HEX': число }` только для файлов, где что-то нашлось. */
export const countRetired = () => {
  const counts = new Map()
  for (const p of scannedFiles()) {
    const found = countInSource(readFileSync(join(root, p), 'utf8'))
    if (Object.keys(found).length) counts.set(p, found)
  }
  return counts
}

export const readAllowlist = () => {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(ALLOWLIST, 'utf8'))))
  } catch {
    return new Map()
  }
}

const total = (obj) => Object.values(obj).reduce((s, n) => s + n, 0)

/** Где снятых цветов стало БОЛЬШЕ разрешённого. */
export const findExcess = () => {
  const allowed = readAllowlist()
  const hits = []
  for (const [file, found] of countRetired()) {
    const limit = allowed.get(file) ?? {}
    for (const [hex, n] of Object.entries(found)) {
      const max = limit[hex] ?? 0
      if (n > max) hits.push(`${file}: ${hex} — найдено ${n}, разрешено ${max} (${RETIRED[hex]})`)
    }
  }
  return hits.sort()
}

/** Где список отстал: цвет ушёл, а разрешение осталось. Храповик крутится вниз. */
export const findStaleAllowlist = () => {
  const counts = countRetired()
  const stale = []
  for (const [file, limit] of readAllowlist()) {
    const found = counts.get(file) ?? {}
    for (const [hex, max] of Object.entries(limit)) {
      const n = found[hex] ?? 0
      if (n < max) stale.push(`${file}: ${hex} — разрешено ${max}, осталось ${n}`)
    }
  }
  return stale.sort()
}

const HINT =
  'Взять цвет из токенов src/index.css: --primary вместо старого чёрного,\n' +
  '--action или --signal вместо лайма (по фону: на тёмном жёлтый, на светлом\n' +
  'красный). Затем УМЕНЬШИТЬ число в scripts/retired-palette-allowlist.json.\n' +
  'Заморозить новое место можно только осознанно:\n' +
  '  node scripts/check-retired-palette.mjs --freeze'

if (process.argv[1] && process.argv[1].endsWith('check-retired-palette.mjs')) {
  if (process.argv.includes('--freeze')) {
    const counts = [...countRetired()].sort((a, b) => a[0].localeCompare(b[0]))
    writeFileSync(ALLOWLIST, `${JSON.stringify(Object.fromEntries(counts), null, 2)}\n`)
    console.log(`Заморожено файлов: ${counts.length} → ${rel(ALLOWLIST)}`)
    process.exit(0)
  }

  const counts = countRetired()
  const sum = [...counts.values()].reduce((s, o) => s + total(o), 0)
  const excess = findExcess()
  const stale = findStaleAllowlist()

  console.log(`файлов просмотрено: ${countScannedFiles()}, со снятой палитрой: ${counts.size}, вхождений: ${sum}`)
  for (const h of excess) console.log(`БОЛЬШЕ РАЗРЕШЁННОГО  ${h}`)
  for (const h of stale) console.log(`СПИСОК ОТСТАЛ        ${h}`)
  if (excess.length || stale.length) console.log(`\n${HINT}`)
  console.log(excess.length === 0 && stale.length === 0
    ? 'снятой палитры не прибавилось, список соответствует коду'
    : `${excess.length + stale.length} расхождений`)
  process.exit(excess.length || stale.length ? 1 : 0)
}
