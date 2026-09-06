// Храповик против прямого доступа к базе из страниц и компонентов.
//
// ЗАЧЕМ. Sprint 2 перенёс запросы в хуки, но перенос ничем не держался: на
// 06.09 в src оставалось 18 прямых обращений `supabase.from|rpc` в семи
// файлах вне src/hooks, и каждое новое добавлялось молча. Цена не
// стилистическая. Запрос в компоненте — это:
//
//   • второй тип на одну строку. Ровно так на витрине жили самодельные
//     `interface Item` и `type BrowseRow` с приведением между ними: форма
//     ответа не сверялась со схемой, и расхождение дало бы пустые карточки,
//     а не отказ сборки;
//   • кэш, который никто не инвалидирует. «Мои вещи» держались на ручных
//     setQueryData внутри страницы и устаревали при любом действии с другой
//     страницы (ключ ['bookings', userId] не инвалидировала ни одна мутация);
//   • запрос, который нельзя проверить отдельно от разметки: на vitest
//     приходится рендерить страницу целиком.
//
// ПОЧЕМУ ХРАПОВИК, А НЕ ЗАПРЕТ. Вынести все 18 обращений одним PR значило бы
// переписать Admin, ItemDetail и ListItem разом — ревью такого диффа вслепую,
// а правило проекта «одна задача = один PR». Поэтому список известных мест
// заморожен в db-access-allowlist.json (файл → допустимое число), а падение
// дают только ДВА случая: где-то стало БОЛЬШЕ (новый прямой доступ) или
// стало МЕНЬШЕ (число в списке пора уменьшить). Второе обязательно: храповик,
// который крутится только вверх, — это список, который перестаёт описывать
// код.
//
// ЧТО НЕ СЧИТАЕТСЯ И ПОЧЕМУ.
//
//   • src/hooks/** — разрешены без ограничений. Смысл правила в том, чтобы
//     страницы и компоненты ходили в базу через хуки, а не в том, чтобы
//     запросов не было вовсе;
//   • __tests__ — там заглушки, а не запросы;
//   • supabase.auth, supabase.storage и supabase.functions.invoke — не
//     обращение к таблицам: сессия, файлы и edge-функции живут по своим
//     правилам (для функций есть src/lib/edgeInvoke.ts);
//   • комментарии. В Admin.tsx и useAdminAction.ts фразы «Прямой
//     supabase.from(...).update(...) отсюда убран» — это проза о прошлом, и
//     считать их обращениями значило бы навсегда приписать файлам лишний
//     запрос.
//
// ЧТО СЧИТАЕТСЯ, но не виделось прежними проверками глазами: цепочка,
// разорванная переводом строки (`await supabase\n  .from('items')`). Из-за
// неё ручной подсчёт по grep -n давал 4 обращения в ItemDetail вместо 7 и
// пропускал ItemBlackouts.load() и Register.tsx целиком.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ALLOWLIST = join(root, 'scripts', 'db-access-allowlist.json')

// Каталоги, где прямой запрос разрешён или невозможен.
const SKIP = ['/__tests__/', '/hooks/', '/test/']

// `supabase.from`, `supabase.rpc` — в том числе разорванные переводом строки.
// `\s*` между ними и точкой ловит цепочку, записанную столбиком.
const DB_CALL = /supabase\s*\.\s*(?:from|rpc)\b/g

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/')

/**
 * Число прямых обращений к базе в одном файле.
 *
 * Комментарии снимаются до подсчёта: блочные — целиком, строчные — по
 * признаку «строка начинается с //, * или /*». Снять комментарии регуляркой
 * по всему тексту нельзя: `//` встречается внутри строк (`https://…`), и
 * жадный разбор спрятал бы настоящий запрос.
 */
export const countInSource = (source) => {
  const withoutBlocks = String(source).replace(/\/\*[\s\S]*?\*\//g, '')
  const code = withoutBlocks
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
  return (code.match(DB_CALL) || []).length
}

const scannedFiles = () => walk(join(root, 'src'))
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map(rel)
  .filter((p) => !SKIP.some((s) => `/${p}`.includes(s)))

/** Сколько файлов реально просмотрено. Ноль = обход сломан. */
export const countScannedFiles = () => scannedFiles().length

/**
 * Прямые обращения по файлам: `путь → число`. В карте только файлы, где
 * обращений больше нуля: отсутствие файла означает «здесь их нет».
 */
export const countDbAccess = () => {
  const counts = new Map()
  for (const p of scannedFiles()) {
    const n = countInSource(readFileSync(join(root, p), 'utf8'))
    if (n > 0) counts.set(p, n)
  }
  return counts
}

/** Замороженный список: `путь → допустимое число`. */
export const readAllowlist = () => {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST, 'utf8'))
    return new Map(Object.entries(raw))
  } catch {
    return new Map()
  }
}

/** Где обращений стало БОЛЬШЕ разрешённого (включая файлы вне списка). */
export const findExcess = () => {
  const allowed = readAllowlist()
  const hits = []
  for (const [file, n] of countDbAccess()) {
    const limit = allowed.get(file) ?? 0
    if (n > limit) hits.push(`${file}: найдено ${n}, разрешено ${limit}`)
  }
  return hits.sort()
}

/**
 * Где список отстал от кода: обращений стало МЕНЬШЕ, чем разрешено, или файл
 * исчез. Пусто = список описывает факт, а не намерение.
 */
export const findStaleAllowlist = () => {
  const counts = countDbAccess()
  const stale = []
  for (const [file, limit] of readAllowlist()) {
    const n = counts.get(file) ?? 0
    if (n < limit) stale.push(`${file}: разрешено ${limit}, осталось ${n}`)
  }
  return stale.sort()
}

const HINT =
  'Вынести запрос в src/hooks/** (страницы и компоненты ходят в базу через\n' +
  'хуки) и УМЕНЬШИТЬ число в scripts/db-access-allowlist.json. Замораживать\n' +
  'новое место можно только осознанно:\n' +
  '  node scripts/check-db-access.mjs --freeze'

if (process.argv[1] && process.argv[1].endsWith('check-db-access.mjs')) {
  if (process.argv.includes('--freeze')) {
    const counts = [...countDbAccess()].sort((a, b) => a[0].localeCompare(b[0]))
    writeFileSync(ALLOWLIST, `${JSON.stringify(Object.fromEntries(counts), null, 2)}\n`)
    console.log(`Заморожено файлов: ${counts.length}, обращений: ${counts.reduce((s, [, n]) => s + n, 0)} → ${rel(ALLOWLIST)}`)
    process.exit(0)
  }

  const counts = countDbAccess()
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  const excess = findExcess()
  const stale = findStaleAllowlist()

  console.log(`файлов просмотрено: ${countScannedFiles()}, с прямым доступом: ${counts.size}, обращений: ${total}`)
  for (const h of excess) console.log(`БОЛЬШЕ РАЗРЕШЁННОГО  ${h}`)
  for (const h of stale) console.log(`СПИСОК ОТСТАЛ        ${h}`)
  if (excess.length || stale.length) console.log(`\n${HINT}`)
  console.log(excess.length === 0 && stale.length === 0
    ? 'прямого доступа к базе не прибавилось, список соответствует коду'
    : `${excess.length + stale.length} расхождений со списком прямого доступа`)
  process.exit(excess.length || stale.length ? 1 : 0)
}
