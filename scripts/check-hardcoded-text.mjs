// Храповик против текста, вшитого в разметку мимо словарей.
//
// ЗАЧЕМ ОТДЕЛЬНО ОТ check-i18n-keys. Тот проверяет, что каждый t('…')
// существует во всех трёх языках. Строку, которую вообще не завернули в
// t(), он не видит В ПРИНЦИПЕ — и не увидит никогда, сколько его ни
// усиливай. Именно так `ForgotPassword` и `ResetPassword` прожили
// полностью ПО-АНГЛИЙСКИ на французском продукте, пережив перенос 121
// строки в словари (#30): их там просто не было.
//
// ПОЧЕМУ ХРАПОВИК, А НЕ ЗАПРЕТ. Надёжно отличить пользовательский текст
// от кода одной регуляркой нельзя: `>` и `<` в JSX неотличимы от
// сравнения, а часть строк переводить и не надо (логотип, атрибуция
// OpenStreetMap, служебная страница /admin). Поэтому список известных
// попаданий заморожен в hardcoded-text-allowlist.json, а падение даёт
// только НОВОЕ. Список можно уменьшать, увеличивать — осознанно.
//
// ИЗВЕСТНАЯ СЛЕПАЯ ЗОНА: разбор построчный, поэтому текст, стоящий на
// отдельной строке между тегами, не ловится. Так «Laisser un avis» в
// ItemDetail.tsx пережил первый скан 14.08 и нашёлся глазами.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const ALLOWLIST = join(here, 'hardcoded-text-allowlist.json')

// Юридические страницы — намеренное исключение (решение 13.08): это
// документы с таблицами и разметкой, а не строки интерфейса; у них три
// отдельных языковых компонента.
const SKIP = ['Privacy.tsx', 'Terms.tsx', '__tests__', 'parked']

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const TEXT = />([^<>{}]*[A-Za-zÀ-ÿ]{3,}[^<>{}]*)</g
const ATTR = /\b(placeholder|title|aria-label)="([^"]*[A-Za-zÀ-ÿ]{3,}[^"]*)"/g

export const findHardcodedText = () => {
  const files = walk(join(root, 'src'))
    .filter((f) => /\.tsx$/.test(f) && !SKIP.some((s) => f.includes(s)))

  const hits = []
  for (const f of files) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/')
    readFileSync(f, 'utf8').split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      for (const m of line.matchAll(TEXT)) {
        const txt = m[1].trim()
        // Числа, валюты и пунктуация переводить нечего.
        if (!txt || /^[\d\s.,:%€|—–-]+$/.test(txt)) continue
        hits.push(`${rel} :: ${txt}`)
      }
      for (const m of line.matchAll(ATTR)) {
        hits.push(`${rel} :: [${m[1]}] ${m[2].trim()}`)
      }
    })
  }
  return [...new Set(hits)].sort()
}

export const readAllowlist = () => {
  try {
    return new Set(JSON.parse(readFileSync(ALLOWLIST, 'utf8')))
  } catch {
    return new Set()
  }
}

/** Попадания, которых нет в замороженном списке. Пусто = чисто. */
export const findNewHardcodedText = () => {
  const allowed = readAllowlist()
  return findHardcodedText().filter((h) => !allowed.has(h))
}

if (process.argv[1] && process.argv[1].endsWith('check-hardcoded-text.mjs')) {
  if (process.argv.includes('--freeze')) {
    const all = findHardcodedText()
    writeFileSync(ALLOWLIST, `${JSON.stringify(all, null, 2)}\n`)
    console.log(`Заморожено попаданий: ${all.length} → ${ALLOWLIST}`)
    process.exit(0)
  }

  const all = findHardcodedText()
  const fresh = findNewHardcodedText()
  console.log(`попаданий всего: ${all.length}, из них в списке: ${all.length - fresh.length}`)
  for (const h of fresh) console.log(`НОВОЕ  ${h}`)
  console.log(fresh.length === 0
    ? 'нового текста мимо словарей нет'
    : `${fresh.length} новых строк мимо словарей — завернуть в t() или, если перевод не нужен, добавить в список через --freeze`)
  process.exit(fresh.length ? 1 : 0)
}
