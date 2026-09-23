// src/domain/routeIndexing.ts
//
// Решение по КАЖДОМУ маршруту: пускать ли туда поисковик.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ДВА ГОТОВЫХ ТЕКСТА В public/. До 21.09 у
// продукта не было ни robots.txt, ни sitemap.xml вовсе. Положить их
// файлами было бы быстрее — и это ровно тот способ, которым они
// разъезжаются: маршрут добавляют в App.tsx, а в список его дописать
// забывают, потому что напоминать некому.
//
// Здесь список один, и он ОБЯЗАН покрывать все маршруты: сторож
// (src/__tests__/shell.test.ts) сверяет его с `<Route path=…>` в App.tsx
// в обе стороны. Новый экран без решения роняет набор — и это
// правильная цена, потому что молчаливое умолчание здесь означает
// «пустить поисковик куда попало».
//
// ПОЧЕМУ УМОЛЧАНИЕ НЕ «ИНДЕКСИРОВАТЬ». Кабинет, чужие брони и админка
// отдаются тем же index.html, что витрина: краулер получает на них
// код 200 и полноценную страницу. Ни одного из этих адресов в выдаче
// быть не должно, и узнать об этом по ответу сервера нельзя.

/** Что делать поисковику с адресом. */
export type Indexing =
  /** В выдачу. Попадает в sitemap.xml. */
  | 'index'
  /** За входом. Закрывается в robots.txt: содержимое личное. */
  | 'private'
  /** Открыт всем, но в выдаче не нужен: служебный шаг, не страница. */
  | 'noindex'

export interface RouteRule {
  readonly indexing: Indexing
  /** Вес относительно других страниц сайта; только для 'index'. */
  readonly priority?: number
  /** Как часто содержимое меняется; только для 'index'. */
  readonly changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** Почему именно так. Короткая строка, читается в сторожах. */
  readonly why: string
}

/**
 * Маршрут → решение.
 *
 * Ключи записаны так же, как в `<Route path=…>`, включая параметры
 * (`/item/:id`): сверка идёт посимвольно, и «почти такой же» путь
 * сторож обязан увидеть как расхождение.
 */
export const ROUTE_INDEXING: Readonly<Record<string, RouteRule>> = {
  '/': {
    indexing: 'index',
    priority: 1.0,
    changefreq: 'weekly',
    why: 'Вход. Единственная страница, объясняющая, что это за сервис',
  },
  '/browse': {
    indexing: 'index',
    priority: 0.9,
    changefreq: 'daily',
    why: 'Витрина: содержимое меняется с каждым новым объявлением',
  },
  '/rental-shops': {
    indexing: 'index',
    priority: 0.5,
    changefreq: 'monthly',
    why: 'Обращение к прокатчикам. Единственная страница под их запрос',
  },
  '/privacy': {
    indexing: 'index',
    priority: 0.3,
    changefreq: 'yearly',
    why: 'Юридический документ; на него ссылаются извне, он должен находиться',
  },
  '/terms': {
    indexing: 'index',
    priority: 0.3,
    changefreq: 'yearly',
    why: 'То же самое',
  },

  // ── Вещи. В sitemap их нет, и это НЕ недосмотр ───────────────────
  // Адреса вида /item/:id известны только базе, а sitemap собирается
  // на сборке, где базы нет. Отдать вместо них шаблон `:id` значит
  // послать поисковика по несуществующему адресу. Настоящая карта
  // вещей — это отдельная задача: её отдаёт сервер, а не сборка.
  '/item/:id': {
    indexing: 'noindex',
    why: 'Динамический адрес; на сборке список вещей неизвестен',
  },

  // ── За входом ────────────────────────────────────────────────────
  '/list-item': { indexing: 'private', why: 'Форма владельца, требует входа' },
  '/edit-item/:id': { indexing: 'private', why: 'Правка чужого добра' },
  '/my-items': { indexing: 'private', why: 'Личный список' },
  '/my-rentals': { indexing: 'private', why: 'Личные брони' },
  '/activity': { indexing: 'private', why: 'Личная лента событий' },
  '/profile': { indexing: 'private', why: 'Кабинет' },
  '/admin': { indexing: 'private', why: 'Админка' },

  // ── Служебные шаги ───────────────────────────────────────────────
  // Открыты всем, но страницами не являются. Отдельно про
  // /reset-password: в его адресе приезжает одноразовый токен из
  // письма. Такому адресу в индексе не место ни при каких условиях.
  '/login': { indexing: 'noindex', why: 'Шаг, а не страница' },
  '/register': { indexing: 'noindex', why: 'Шаг, а не страница' },
  '/forgot-password': { indexing: 'noindex', why: 'Шаг, а не страница' },
  '/reset-password': { indexing: 'noindex', why: 'В адресе одноразовый токен из письма' },

  // Заглушка «страница не найдена». Ответа 404 продукт не отдаёт —
  // SPA на любой адрес возвращает 200, — поэтому закрыть её можно
  // только здесь.
  '*': { indexing: 'noindex', why: 'Не адрес, а перехват остальных' },
}

/** Адреса, которые идут в sitemap.xml. */
export const indexedRoutes = (): Array<[string, RouteRule]> =>
  Object.entries(ROUTE_INDEXING).filter(([, r]) => r.indexing === 'index')

/** Адреса, закрытые от обхода. */
export const disallowedRoutes = (): string[] =>
  Object.entries(ROUTE_INDEXING)
    .filter(([, r]) => r.indexing === 'private' || r.indexing === 'noindex')
    .map(([path]) => path)
    // Параметр в пути для robots.txt бессмыслен: `Disallow: /edit-item/`
    // закрывает всю ветку, а `/edit-item/:id` — буквальный адрес с
    // двоеточием, которого не существует.
    .map((path) => (path.includes('/:') ? `${path.slice(0, path.indexOf('/:'))}/` : path))
    .filter((path) => path !== '*')
    .sort()

/** Текст robots.txt. */
export const robotsTxt = (siteUrl: string): string =>
  [
    '# Составляется на сборке из src/domain/routeIndexing.ts.',
    '# Править этот файл руками бессмысленно: он перезаписывается.',
    '',
    'User-agent: *',
    ...disallowedRoutes().map((path) => `Disallow: ${path}`),
    'Allow: /',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')

/** Текст sitemap.xml. */
export const sitemapXml = (siteUrl: string, lastmod: string): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...indexedRoutes().flatMap(([path, rule]) => [
      '  <url>',
      `    <loc>${siteUrl}${path === '/' ? '/' : path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${rule.changefreq}</changefreq>`,
      `    <priority>${rule.priority?.toFixed(1)}</priority>`,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n')
