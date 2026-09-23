import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { SITE_URL } from './supabase/functions/_shared/operator'
import { robotsTxt, sitemapXml } from './src/domain/routeIndexing'
import { readFileSync } from 'node:fs'
import { injectSiteUrl as applySiteUrl, stripHtmlComments as removeComments } from './src/domain/shellHtml'

/**
 * Адрес сайта в index.html — ПОДСТАВЛЯЕТСЯ, а не написан.
 *
 * ЗАЧЕМ. `supabase/functions/_shared/operator.ts` заведён ровно затем,
 * чтобы адрес существовал в одном экземпляре: его знают и письма с
 * сервера, и юридические страницы в браузере. В шапке того файла стоит
 * предупреждение, что `rentit.be` ЗАНЯТ и принадлежит постороннему лицу.
 *
 * Третья копия туда не попала — статический HTML не умеет импортировать
 * модуль. И к 21.09 index.html всё ещё отдавал `https://rentit.be`
 * четырежды в hreflang и дважды в разметке schema.org. То есть
 * структурированные данные сообщали поисковику, что канонический адрес
 * продукта — чужой домен, а четыре hreflang уводили на него же каждую
 * языковую версию.
 *
 * Поймать это чтением html было нельзя: строка выглядит как совершенно
 * обычный абсолютный адрес. Поэтому литерал убран, а сторож
 * (src/__tests__/shell.test.ts) запрещает домену появиться там снова.
 *
 * ПОЧЕМУ НЕ `%VITE_SITE_URL%` ЧЕРЕЗ .env. Тогда адрес существовал бы в
 * двух источниках — в модуле и в переменной окружения, — и разошлись бы
 * они молча, ровно как раньше расходились страницы и письма.
 */
const injectSiteUrl = (): Plugin => ({
  name: 'rentit-site-url',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => applySiteUrl(html, SITE_URL),
  },
})

/**
 * Пояснения из index.html не уезжают посетителю.
 *
 * В шапке документа живут длинные комментарии по-русски: почему снят
 * unpkg, почему из описания убрано обещание страховки, почему превью
 * растровое. Они написаны для того, кто откроет репозиторий, и там
 * обязаны остаться — в них причина, без которой правку повторят обратно.
 *
 * Но Vite отдаёт html как есть, и полтора килобайта внутренней переписки
 * скачивал КАЖДЫЙ посетитель. Вместе с ними наружу уезжало и имя чужого
 * домена, о котором там идёт речь: единственное упоминание `rentit.be`,
 * оставшееся в собранной странице, было в объяснении, почему его там
 * больше нет.
 *
 * Снимаем только на сборке. В `vite dev` комментарии на месте — там их
 * читает разработчик.
 */
const stripHtmlComments = (): Plugin => ({
  name: 'rentit-strip-html-comments',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: removeComments,
  },
})

/**
 * robots.txt и sitemap.xml — СОБИРАЮТСЯ, а не лежат файлами.
 *
 * ЗАЧЕМ. До 21.09 их не было вовсе, и это скрывалось идеально: на
 * `/robots.txt` прод отвечал 200, потому что любой неизвестный адрес SPA
 * получает index.html. Проверка «файл на месте?» по коду ответа давала
 * «да» там, где файла не существовало ни одного дня.
 *
 * ПОЧЕМУ НЕ ПОЛОЖИТЬ ГОТОВЫМИ В public/. Оба текста производные: один
 * от адреса сайта, другой от списка маршрутов. Положенные руками, они
 * устаревают в тот день, когда в App.tsx появляется новый экран, и
 * никто об этом не узнает — карта сайта не ломается, она просто молча
 * неполна. Здесь источник один (src/domain/routeIndexing.ts), и сторож
 * требует решения для каждого маршрута.
 *
 * ДАТА. `lastmod` берётся с момента сборки, а не пишется руками:
 * человеку, правящему страницу, незачем помнить про дату в карте.
 */
const emitCrawlerFiles = (): Plugin => ({
  name: 'rentit-crawler-files',
  apply: 'build',
  generateBundle() {
    const lastmod = new Date().toISOString().slice(0, 10)
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(SITE_URL) })
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(SITE_URL, lastmod) })
  },
})

/**
 * Service worker собирается ИЗ ШАБЛОНА, потому что должен знать имена
 * файлов сборки — а они содержат хеш содержимого и меняются с каждым
 * выкатом.
 *
 * ПОЧЕМУ НЕ ПОЛОЖИТЬ ГОТОВЫЙ В public/. Ровно так он там и лежал: файл
 * из марта, кэшировавший «/» и «/index.html» и не знавший ни об одном
 * скрипте приложения. Офлайн по нему загрузилась бы пустая оболочка.
 * Список, который пишут руками, устаревает в день первой же сборки.
 *
 * ЧТО ПОПАДАЕТ В ПРЕДЗАГРУЗКУ. Оболочка, код входа, стили и шрифты —
 * то, без чего приложение не покажет НИЧЕГО. Ленивые куски страниц
 * сюда не идут намеренно: скачивать весь продукт при первом заходе с
 * мобильного интернета ради возможного офлайна — плохой размен. Они
 * оседают в кэше по мере того, как человек их открывает.
 */
const buildServiceWorker = (): Plugin => ({
  name: 'rentit-service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle)

    // Точка входа и её стили: без них не покажется ничего.
    const entry = files.filter((f) => {
      const chunk = bundle[f]
      return chunk.type === 'chunk' && chunk.isEntry
    })
    const css = files.filter((f) => f.endsWith('.css'))

    const precache = [
      '/',
      '/index.html',
      '/manifest.json',
      ...entry.map((f) => `/${f}`),
      ...css.map((f) => `/${f}`),
      '/fonts/outfit.woff2',
      '/fonts/source-sans-3.woff2',
      '/favicon.svg',
      '/icons/icon-192.png',
    ]

    // Версия кэша = содержимое предзагрузки. Имена файлов содержат
    // хеш, поэтому новая сборка даёт новую версию, а неизменная —
    // прежнюю, и кэш не сбрасывается впустую.
    const version = createHash(precache.join('|'))

    const template = readFileSync('src/sw.template.js', 'utf8')
    const source = template
      // Глобально, а не первое вхождение: первая версия заменила
      // плейсхолдер В КОММЕНТАРИИ шаблона, где он был упомянут как
      // пример, и до кода правка не дошла.
      .replace(/__VERSION__/g, version)
      .replace(/__PRECACHE__/g, JSON.stringify(precache, null, 2))

    this.emitFile({ type: 'asset', fileName: 'sw.js', source })
  },
})

/** Короткий отпечаток строки. Своего алгоритма не изобретаем. */
const createHash = (input: string): string => {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// Какая сборка работает у человека. Без этого отчёт о поломке не отвечает
// на первый вопрос починки — «это ещё в проде или уже исправлено?».
// Vercel кладёт коммит в окружение сборки; локально сборка — 'local'.
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'local'

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), injectSiteUrl(), stripHtmlComments(), emitCrawlerFiles(), buildServiceWorker()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
