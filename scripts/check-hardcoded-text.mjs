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
// ДВЕ СЛЕПЫЕ ЗОНЫ ЗАКРЫТЫ 17.08.2026 — обе оказались обитаемы.
//
// Зона 1: текст на ОТДЕЛЬНОЙ СТРОКЕ между тегами. Разбор был построчный,
// и `>` с `<` оказывались на разных строках. Так «Laisser un avis» пережил
// скан 14.08 и нашёлся глазами. Пряталось там ещё девять строк, включая
// экран после отправки заявки на странице вещи.
//
// Зона 2: текст в СТРОКОВЫХ ЛИТЕРАЛАХ кода, а не в разметке — window.confirm
// при похожем объявлении, отказы загрузки аватара, «Aucun avis pour le
// moment». Ещё шесть строк.
//
// Итого пятнадцать мест, где трёхъязычный продукт говорил по-французски с
// англичанином и голландцем, — и гейт, поставленный ровно против этого,
// их не видел. Правило: гейт, у которого известна слепая зона, обязан
// либо её закрыть, либо считаться непройденным.
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
// Зона 2: строковый литерал в коде. Ловим щедро — это храповик, а не
// запрет: лишнее уходит в замороженный список один раз, зато НОВОЕ уже не
// проскочит. Скупая регулярка пропустила бы «Aucun avis pour le moment»,
// где нет ни одного диакритического знака.
const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g

const wordCount = (t) => t.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2}/.test(w)).length

const isProse = (txt) => {
  const t = txt.trim()
  if (t.length < 12) return false
  if (!/[A-Za-zÀ-ÿ]{3}/.test(t)) return false
  if (/^https?:|^\//i.test(t)) return false
  return wordCount(t) >= 3
}

// Служебные слова французского и нидерландского. В коде идентификаторы
// английские, поэтому эти слова — надёжный признак строки, которую видит
// человек. Английский текст ловится первой зоной (он живёт в разметке);
// сюда он не попадает намеренно — иначе список утонул бы в CSS-значениях
// и именах классов, а список из девяноста строк шума просто перестают
// читать, и настоящая строка спрячется прямо в нём.
const FR_NL = /\b(le|la|les|des|une|vous|votre|vos|est|sont|pas|doit|être|avec|pour|dans|sur|par|déjà|aucun|autre|lors|ligne|van|het|een|niet|uw|moet|geen|wordt|voor|met)\b/i

const isUserFacingLiteral = (txt) => {
  const t = txt.trim()
  if (t.length < 12) return false
  if (/<[a-z]/i.test(t)) return false          // кусок разметки, не фраза
  if (/var\(--|\dpx|rgba?\(|clamp\(|minmax\(/.test(t)) return false
  return wordCount(t) >= 3 && FR_NL.test(t)
}

export const findHardcodedText = () => {
  const files = walk(join(root, 'src'))
    .filter((f) => /\.(tsx|ts)$/.test(f) && !SKIP.some((s) => f.includes(s)))

  const hits = []
  for (const f of files) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/')
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return

      if (/\.tsx$/.test(f)) {
        for (const m of line.matchAll(TEXT)) {
          const txt = m[1].trim()
          // Числа, валюты и пунктуация переводить нечего.
          if (!txt || /^[\d\s.,:%€|—–-]+$/.test(txt)) continue
          hits.push(`${rel} :: ${txt}`)
        }
        for (const m of line.matchAll(ATTR)) {
          hits.push(`${rel} :: [${m[1]}] ${m[2].trim()}`)
        }

        // Зона 1: строка — сплошной текст, а открывающий тег остался на
        // предыдущей строке. Внутри разметки мы, только если предыдущая
        // непустая строка заканчивается на `>`.
        if (trimmed && !/[<>{}=;`]/.test(trimmed) && isProse(trimmed)) {
          let j = i - 1
          while (j >= 0 && !lines[j].trim()) j--
          if (j >= 0 && lines[j].trim().endsWith('>')) hits.push(`${rel} :: ${trimmed}`)
        }
      }

      // Зона 2 — и в .tsx, и в .ts: подтверждения и отказы живут в хуках,
      // а видит их тот же человек. `console.*` пропускаем: это адресовано
      // разработчику, и переводить его незачем.
      if (!/\bconsole\.\w+\s*\(/.test(trimmed)) {
        for (const m of line.matchAll(LITERAL)) {
          const txt = m[2].trim()
          if (isUserFacingLiteral(txt)) hits.push(`${rel} :: ${txt}`)
        }
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
