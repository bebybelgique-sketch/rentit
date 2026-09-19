// Храповик против цветных эмодзи в интерфейсе.
//
// ЗАЧЕМ. Продукт рисует значки одной обводкой: CategoryIcon для категорий,
// StateIcon для состояний, 24×24, currentColor. Цветной объёмный эмодзи
// рядом с ними — второй визуальный язык, и на телефоне он выигрывает:
// картинка в 52 px оказывается самым ярким пятном экрана, ярче
// единственного действия.
//
// 19.09.2026, обход живого прода с телефона, нашёл их в двух слоях:
//   • в разметке — 🔨 на витрине, 📦 в «Моих вещах», 📸 в выкладке;
//   • в СЛОВАРЯХ — шесть названий категорий (⚡🔧🌿🏗️🧹📐), 🎉 в
//     приглашении и 📍 в кнопке «À proximité». Эти видны в главном потоке:
//     «⚡ Électroportatif» стоит в списке категорий формы выкладки.
// Причём в английском словаре 🎉 и 📍 не было — то есть один и тот же
// экран говорил на разных языках в зависимости от выбранного языка.
//
// Долг записан прямым текстом в шапке CategoryIcon ещё при её заведении:
// «эмодзи стоят ещё на витрине, на странице вещи и в форме выкладки;
// заменить их там — отдельная работа по четырём экранам».
//
// ЧТО ИМЕННО ЛОВИТСЯ. Свойство Unicode `Emoji_Presentation` — знаки,
// которые ПО УМОЛЧАНИЮ рисуются цветной картинкой. Оно проводит ровно
// нужную границу: ⚡🔧🌿🎉📍📦 — да; ✓ ✦ → · — нет, это одноцветная
// типографика, и ей в тексте место. Диапазонами это не различить: ⚡ (U+26A1)
// стоит в том же блоке, что ✓ (U+2713) и ✦ (U+2726).
//
// ИСКЛЮЧЕНИЕ. share.whatsappText: этот текст уезжает в чужое приложение,
// где эмодзи — норма, а не разнобой. Исключение названо поимённо в
// allowlist, а не зашито условием: список читают, условие — нет.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ALLOWLIST = join(root, 'scripts', 'emoji-allowlist.json')

const EMOJI = /\p{Emoji_Presentation}/u
const EMOJI_G = /\p{Emoji_Presentation}/gu

const SKIP = ['/__tests__/', '/test/']

/** Цветные эмодзи в строке. Пусто = чисто. */
export const emojiIn = (text) => String(text).match(EMOJI_G) ?? []

/** Плоский обход словаря: `ключ.через.точку → строка`. */
export const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  )

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/')

export const readAllowlist = () => {
  try {
    return new Set(JSON.parse(readFileSync(ALLOWLIST, 'utf8')))
  } catch {
    return new Set()
  }
}

/** Ключи словарей с цветными эмодзи: `язык:ключ`. */
export const findInLocales = () => {
  const allowed = readAllowlist()
  const hits = []
  const dir = join(root, 'src', 'locales')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const lang = file.replace('.json', '')
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    for (const [key, value] of flatten(json)) {
      if (typeof value !== 'string') continue
      const found = emojiIn(value)
      if (found.length && !allowed.has(key)) {
        hits.push(`${lang}: ${key} = ${found.join('')} «${value.slice(0, 48)}»`)
      }
    }
  }
  return hits.sort()
}

/**
 * Эмодзи в разметке. Комментарии снимаются: «Был 🔨 в 52 px» — это ЗАПИСЬ
 * о замене, и запрещать её значит стирать причину.
 */
export const findInSource = () => {
  const hits = []
  const files = walk(join(root, 'src'))
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map(rel)
    .filter((p) => !SKIP.some((s) => `/${p}`.includes(s)))

  for (const p of files) {
    // Строки комментариев ОБНУЛЯЮТСЯ, а не выбрасываются: выброс сдвигает
    // нумерацию, и сторож начинает указывать не на ту строку. Инструмент,
    // который врёт координатой, хуже отсутствующего — читатель идёт по
    // ложному следу и перестаёт ему верить.
    const code = readFileSync(join(root, p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .split(/\r?\n/)
      .map((line) => {
        const t = line.trim()
        return (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) ? '' : line
      })
    code.forEach((line, i) => {
      const found = emojiIn(line)
      if (found.length) hits.push(`${p}:${i + 1} ${found.join('')}`)
    })
  }
  return hits.sort()
}

/** Сколько файлов словарей просмотрено. Ноль = обход сломан. */
export const countLocales = () =>
  readdirSync(join(root, 'src', 'locales')).filter((f) => f.endsWith('.json')).length

export const findAll = () => [...findInLocales(), ...findInSource()]

const HINT =
  'Значок берётся из CategoryIcon (категории) или StateIcon (состояния):\n' +
  '24×24, одна обводка, currentColor. Если эмодзи действительно нужен —\n' +
  'например текст уезжает в чужое приложение, — ключ вносится ПОИМЁННО в\n' +
  'scripts/emoji-allowlist.json вместе с причиной в этом файле.'

if (process.argv[1] && process.argv[1].endsWith('check-emoji-in-ui.mjs')) {
  if (process.argv.includes('--freeze')) {
    const keys = findInLocales().map((h) => h.split(': ')[1].split(' = ')[0])
    writeFileSync(ALLOWLIST, `${JSON.stringify([...new Set(keys)].sort(), null, 2)}\n`)
    console.log(`Заморожено ключей: ${new Set(keys).size} → ${rel(ALLOWLIST)}`)
    process.exit(0)
  }

  const hits = findAll()
  console.log(`словарей: ${countLocales()}, разрешено поимённо: ${readAllowlist().size}`)
  for (const h of hits) console.log(`ЭМОДЗИ  ${h}`)
  if (hits.length) console.log(`\n${HINT}`)
  console.log(hits.length === 0
    ? 'цветных эмодзи в интерфейсе нет'
    : `${hits.length} мест с эмодзи`)
  process.exit(hits.length ? 1 : 0)
}
