// Лицо продукта снаружи: превью ссылки и иконка приложения.
//
// ЗАЧЕМ ВООБЩЕ СКРИПТ. До 21.09 в `og:image` стоял
// `/icons/og-image.svg`. Facebook, LinkedIn, WhatsApp, Telegram и Signal
// SVG в превью НЕ РЕНДЕРЯТ — ни один из них. То есть продукт, у которого
// пересылка ссылки соседу и есть весь канал, показывал пустой
// прямоугольник. Заметить это по коду было нельзя: файл лежал на месте и
// отдавался с кодом 200.
//
// Та же невидимость держала на картинке две вещи, снятые из продукта
// месяцами раньше:
//   • лайм #ADFF2F на чёрном #080808 — палитра, отменённая 12.08;
//   • «Insurance included» — обещание страховки, которой нет. Из
//     `og:description` его вычистили, из картинки никто не убрал,
//     потому что картинку никто ни разу не увидел.
//
// Иконка приложения жила с тем же лаймом и по той же причине: человек,
// поставивший сайт на домашний экран, видел снятую палитру каждый день,
// а сторож цветов (check-retired-palette) смотрел только в src/.
//
// ПОЧЕМУ ЧЕРЕЗ CHROMIUM, А НЕ БИБЛИОТЕКОЙ. Растеризатор (sharp, resvg,
// canvas) — это ещё одна зависимость с бинарником под каждую платформу
// ради картинок, которые меняются раз в полгода. Playwright в проекте
// уже стоит, его Chromium умеет и шрифты, и субпиксельное сглаживание —
// ровно то, чем отличается вёрстка от рисования.
//
// ПОЧЕМУ HTML, А НЕ SVG-ФАЙЛЫ. В SVG `<text>` не переносится и не знает
// про кернинг веба: каждая строка позиционируется вручную, и любая
// правка текста ломает раскладку молча. Здесь та же типографика, что в
// продукте, тем же шрифтом Outfit, который лежит в public/fonts.
//
// ЗАПУСК:  node scripts/build-brand-assets.mjs
// РЕЗУЛЬТАТ: public/og-image.png · public/icons/icon-192.png ·
//            icon-512.png · icon-maskable-512.png

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/**
 * Шрифт продукта — внутрь страницы, а не ссылкой.
 *
 * Chromium рендерит офлайн; ссылка на `/fonts/outfit.woff2` не
 * разрешилась бы, и заголовок молча уехал бы на системный шрифт. Тогда
 * превью ссылки выглядело бы чужим по отношению к сайту, куда ведёт.
 */
const fontBase64 = readFileSync(join(root, 'public', 'fonts', 'outfit.woff2')).toString('base64')

const face = (font) => `@font-face {
    font-family: 'Outfit';
    font-weight: 400 800;
    src: url(data:font/woff2;base64,${font}) format('woff2');
  }`

/**
 * Разметка превью ссылки.
 *
 * Палитра — та же, что у продукта (шапка src/index.css): чернила
 * #121417, серебро #CFD4DA, жёлтый #FFC400 СИГНАЛОМ и только на чёрном.
 * Красного здесь нет намеренно: в продукте он означает РОВНО действие,
 * кнопку, которую жмут. В картинке жать нечего, и красный в ней был бы
 * первым шагом к тому, чтобы он снова начал значить «вообще акцент».
 *
 * ЖЁЛТОГО РОВНО СТОЛЬКО, СКОЛЬКО В ПРОДУКТЕ. Первый набросок красил
 * жёлтым всю вторую строку заголовка — восемьдесят шесть пунктов
 * сигнального цвета, который по определению значит «посмотри сюда».
 * Когда им покрашено пол-экрана, он не значит ничего. Осталось три
 * места: метка в логотипе (как в шапке сайта), линейка слева и ОДНО
 * слово — «voisin», ради которого весь продукт и существует.
 *
 * ВЕРТИКАЛЬ. Тот же набросок держал заголовок сверху, и середина
 * оставалась пустой на двести пикселей: взгляд падал в пустоту и
 * возвращался. Теперь блок заголовка занимает свободную высоту целиком,
 * а факты отбиты серебряной волосяной линией — та же линейка, что на
 * корпусе измерительного инструмента.
 */
export const ogHtml = (font) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  ${face(font)}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px;
    background: #121417;
    font-family: 'Outfit', sans-serif;
    color: #F0F1F3;
    -webkit-font-smoothing: antialiased;
    position: relative; overflow: hidden;
  }
  /* Сетка металла: серебро на чернилах, почти на пороге видимости.
     Это фактура корпуса инструмента, а не украшение — поэтому шаг
     ровный и линии не акцентированы ничем. */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(207,212,218,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(207,212,218,0.05) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  /* Жёлтая линейка слева — единственная роль, разрешённая сигналу вне
     текста. Тот же приём, что на тёмных полосах продукта. */
  .rule { position: absolute; left: 0; top: 0; bottom: 0; width: 12px; background: #FFC400; }
  .inner {
    position: relative; height: 100%;
    padding: 66px 90px 58px 104px;
    display: flex; flex-direction: column;
  }
  /* Разрядка НЕ отрицательная. В шапке сайта знак набран 17 пунктами,
     где -0.04em держится; на тридцати та же доля вгоняет «It» в «Rent»,
     и знак читается как «Renttt». Крупный кегль требует своей разрядки,
     а не пересчитанной с мелкого. */
  .mark { font-size: 29px; font-weight: 800; letter-spacing: -0.005em; }
  .mark i { font-style: normal; color: #FFC400; }
  .headline { flex: 1; display: flex; align-items: center; }
  h1 {
    font-size: 88px; line-height: 1.0; font-weight: 800; letter-spacing: -0.04em;
    max-width: 880px;
  }
  h1 em { font-style: normal; color: #FFC400; }
  .facts {
    display: flex; align-items: center; gap: 20px;
    padding-top: 30px; border-top: 1px solid rgba(207,212,218,0.16);
    font-size: 24px; font-weight: 500; color: #CFD4DA;
  }
  .dot { width: 4px; height: 4px; border-radius: 50%; background: #52585F; flex: none; }
</style></head>
<body>
  <div class="grid"></div>
  <div class="rule"></div>
  <div class="inner">
    <div class="mark">Rent<i>It</i></div>
    <div class="headline">
      <h1>L'outil du <em>voisin</em>,<br>quand il vous faut.</h1>
    </div>
    <!-- Регион пишется так же, как в словарях продукта (8 мест против 2).
       По-французски правильнее строчная «wallon», но третьего написания
       заводить нельзя: орфография чинится ОДНИМ проходом по словарям,
       а не по одному месту в каждой правке. -->
  <div class="facts">
      <span>Brabant Wallon</span><span class="dot"></span>
      <span>Sans commission</span><span class="dot"></span>
      <span>Entre particuliers</span>
    </div>
  </div>
</body></html>`

/**
 * Иконка приложения.
 *
 * `pad` — доля стороны, отданная полям. Для maskable она больше: Android
 * режет такую иконку СВОЕЙ формой и съедает до 20 % с каждого края.
 * Жёлтая метка стоит в углу и исчезла бы первой, оставив букву без
 * опознавательного знака.
 *
 * ПОЧЕМУ ФОН НА ОТДЕЛЬНОЙ ПЛАСТИНЕ, А НЕ НА `body`. Первый вариант красил
 * body и скруглял его — иконка вышла с прямыми углами. Причина в правиле
 * CSS: фон `body` РАСПРОСТРАНЯЕТСЯ на холст документа и красит его
 * целиком, а `border-radius` при этом не переносится. Радиус применялся
 * к элементу, фон которого рисовался уже не элементом.
 *
 * Скругление рисуем сами только для обычной иконки. У maskable фон
 * обязан идти до края: систему скруглит своей маской, и наш радиус дал
 * бы тёмный ободок внутри чужого силуэта.
 */
export const iconHtml = (font, { size, pad = 0.14, radius = 0.1875 }) => {
  const inset = size * pad
  const box = size - inset * 2
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  ${face(font)}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${size}px; height: ${size}px; background: transparent; }
  body { font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; }
  .plate {
    position: absolute; inset: 0;
    background: #121417;
    border-radius: ${size * radius}px;
  }
  .box { position: absolute; inset: ${inset}px; }
  /* «R» выключена по центру полей. Её очко занимает около 0.53 ширины
     поля, метка — правые 0.22: столкнуться им негде, и подпирать букву
     ручным отступом не нужно.

     РАЗРЯДКИ ЗДЕСЬ НЕТ, И ЭТО НЕ НЕДОСМОТР. letter-spacing добавляет
     просвет ПОСЛЕ каждого знака, включая последний. На одной букве
     полезного действия у него нет вовсе, а вредное есть: пустая полоса
     справа расширяет строку, и выключка по центру уводит саму букву
     вправо. На maskable-иконке это давало четырнадцать пикселей сдвига
     от центра — заметно, когда система обрезает её кругом. */
  .r {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: ${box * 0.86}px; font-weight: 800; color: #F0F1F3;
  }
  /* Метка — квадрат, а не круг: круг в этой палитре нигде больше не
     встречается, а прямой угол повторяет и сетку, и линейку. */
  .tag {
    position: absolute; right: 0; top: 0;
    width: ${box * 0.22}px; height: ${box * 0.22}px;
    border-radius: ${size * 0.018}px; background: #FFC400;
  }
</style></head>
<body><div class="plate"></div><div class="box"><div class="r">R</div><div class="tag"></div></div></body></html>`
}

/** Что рисуем и куда кладём. */
export const TARGETS = [
  { file: 'public/og-image.png', width: OG_WIDTH, height: OG_HEIGHT, html: ogHtml },
  { file: 'public/icons/icon-192.png', width: 192, height: 192, html: (f) => iconHtml(f, { size: 192 }) },
  { file: 'public/icons/icon-512.png', width: 512, height: 512, html: (f) => iconHtml(f, { size: 512 }) },
  {
    file: 'public/icons/icon-maskable-512.png',
    width: 512, height: 512,
    html: (f) => iconHtml(f, { size: 512, pad: 0.24, radius: 0 }),
  },
]

const main = async () => {
  const browser = await chromium.launch()
  try {
    for (const { file, width, height, html } of TARGETS) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
      await page.setContent(html(fontBase64), { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      // omitBackground — чтобы скруглённые углы иконки остались
      // прозрачными, а не легли белым квадратом на чужой фон.
      const png = await page.screenshot({ type: 'png', omitBackground: true })
      await page.close()
      writeFileSync(join(root, file), png)
      console.log(`${file}: ${width}×${height}, ${(png.length / 1024).toFixed(0)} КБ`)
    }
  } finally {
    await browser.close()
  }
}

// `file://${argv[1]}` на Windows даёт ДВЕ косые, а import.meta.url — три:
// сравнение строк молча не совпадало, и скрипт завершался, ничего не
// написав. pathToFileURL нормализует обе стороны.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
