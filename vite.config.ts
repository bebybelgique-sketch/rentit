import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { SITE_URL } from './supabase/functions/_shared/operator'
import { robotsTxt, sitemapXml } from './src/domain/routeIndexing'
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

export default defineConfig({
  plugins: [react(), injectSiteUrl(), stripHtmlComments(), emitCrawlerFiles()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
