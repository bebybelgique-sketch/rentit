import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTE_INDEXING, robotsTxt, sitemapXml, disallowedRoutes } from '../domain/routeIndexing'
import { injectSiteUrl, stripHtmlComments } from '../domain/shellHtml'
import { SITE_URL, SITE_DOMAIN } from '../domain/operator'

/**
 * Оболочка продукта: то, что видит мир, не заходя внутрь.
 *
 * ЗАЧЕМ ЭТОТ НАБОР СУЩЕСТВУЕТ. 21.09.2026 замер живого прода дал три
 * ответа подряд:
 *
 *   /favicon.svg   200  text/html
 *   /robots.txt    200  text/html
 *   /sitemap.xml   200  text/html
 *
 * Ни одного из трёх файлов не существовало. Двести отдавал SPA-rewrite:
 * любой неизвестный адрес получает index.html. То есть САМАЯ ОЧЕВИДНАЯ
 * проверка — «дёрнуть адрес и посмотреть код» — здесь врёт в трёх
 * случаях из трёх, и врёт в успокаивающую сторону.
 *
 * Поэтому сторож смотрит НА ФАЙЛЫ, а не на ответы. Единственный способ
 * узнать, что иконка есть, — найти её на диске.
 *
 * Тогда же выяснилось, что index.html четырежды в hreflang и дважды в
 * schema.org указывал на `rentit.be` — домен, занятый посторонним лицом
 * (предупреждение об этом стоит в шапке _shared/operator.ts с 14.08).
 * Структурированные данные сообщали поисковику чужой канонический
 * адрес. Прочесть это глазами было нельзя: строка выглядит как обычная
 * ссылка. Ловится только запретом на литерал.
 */

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const indexSource = read('index.html')

/**
 * Проверяем то, что УЕЗЖАЕТ, а не исходник.
 *
 * Разница не косметическая. Первый прогон этого набора упал на моём же
 * комментарии: в пояснении к правке написано, почему там больше нет
 * `rentit.be`, — и запрет на литерал честно это нашёл. Но комментарии
 * сборка снимает, и до посетителя они не доезжают.
 *
 * Обе правки применяются ТЕМИ ЖЕ функциями, что в vite.config.ts
 * (src/domain/shellHtml.ts), а не их копией: копия разошлась бы с
 * плагином в первый же раз, когда правку внесли в одно место из двух.
 */
const indexHtml = stripHtmlComments(indexSource)
const manifest = JSON.parse(read('public/manifest.json'))
const appTsx = read('src/App.tsx')

describe('адрес сайта в index.html не написан руками', () => {
  it('в шапке нет ни одного абсолютного адреса с доменом', () => {
    // Схемы schema.org — это пространство имён, а не ссылка на сайт;
    // их адрес обязан быть буквальным.
    const foreign = [...indexHtml.matchAll(/https?:\/\/[^"'\s<>]+/g)]
      .map(([url]) => url)
      .filter((url) => !url.startsWith('https://schema.org'))
      .filter((url) => !url.startsWith('http://www.sitemaps.org'))

    expect(
      foreign,
      `адрес сайта обязан подставляться через %SITE_URL% (плагин в vite.config.ts),\n` +
        `иначе копия домена живёт отдельно от _shared/operator.ts и расходится молча:\n  ${foreign.join('\n  ')}`,
    ).toEqual([])
  })

  it('подстановка действительно используется', () => {
    expect(indexHtml).toContain('%SITE_URL%')
    // og:url без значения означает, что относительный og:image
    // разрешать не от чего, и превью не показывается вовсе.
    expect(indexHtml).toMatch(/property="og:url" content="%SITE_URL%/)
  })

  it('после подстановки страница ведёт на наш домен', () => {
    const built = injectSiteUrl(indexHtml, SITE_URL)
    expect(built).toContain(`content="${SITE_URL}/"`)
    expect(built).not.toContain('%SITE_URL%')
    expect(built.includes('rentit.be')).toBe(false)
  })
})

describe('превью ссылки', () => {
  const ogImage = indexHtml.match(/property="og:image" content="([^"]+)"/)?.[1]

  it('картинка объявлена', () => {
    expect(ogImage).toBeTruthy()
  })

  /**
   * SVG в превью не рендерит НИ ОДИН крупный клиент: ни Facebook, ни
   * LinkedIn, ни WhatsApp, ни Telegram, ни Signal. Ссылка показывается
   * пустым прямоугольником, и узнать об этом из кода нельзя — файл на
   * месте и отдаётся с кодом 200.
   */
  it('это растр, а не вектор', () => {
    expect(ogImage).toMatch(/\.(png|jpg|jpeg)$/)
  })

  it('размеры объявлены — без них часть клиентов не показывает карточку', () => {
    expect(indexHtml).toMatch(/property="og:image:width" content="1200"/)
    expect(indexHtml).toMatch(/property="og:image:height" content="630"/)
  })
})

/**
 * Файлы, на которые оболочка ссылается, обязаны лежать на диске.
 *
 * Собирается из самих ссылок, а не из списка руками: список руками
 * устаревает ровно тогда, когда добавляют новую ссылку.
 */
const referencedAssets = (): string[] => {
  const fromHtml = [...indexHtml.matchAll(/(?:href|content)="(\/[^"]+\.[a-z0-9]+)"/g)].map(([, p]) => p)
  const fromManifest = [
    ...manifest.icons.map((i: { src: string }) => i.src),
  ]
  // %SITE_URL% уже отрезан регуляркой выше (она требует ведущей косой),
  // а абсолютные адреса картинок берём отдельно.
  const absolute = [...indexHtml.matchAll(/content="%SITE_URL%(\/[^"]+\.[a-z0-9]+)"/g)].map(([, p]) => p)
  return [...new Set([...fromHtml, ...fromManifest, ...absolute])]
}

describe('файлы оболочки существуют на диске', () => {
  // Прод на отсутствующий файл отвечает 200 и отдаёт index.html.
  // Проверка по коду ответа здесь бесполезна — только по файлу.
  it.each(referencedAssets())('%s', (path) => {
    const onDisk = join(root, 'public', path.replace(/^\//, ''))
    expect(existsSync(onDisk), `на ${path} ссылаются, но файла нет в public/`).toBe(true)
  })

  it('проверка вообще что-то нашла', () => {
    // Ноль путей означал бы, что разбор сломан, а набор зелёный.
    expect(referencedAssets().length).toBeGreaterThanOrEqual(5)
  })
})

describe('у каждого маршрута есть решение по индексации', () => {
  /** Пути из `<Route path="…">` — источник правды о маршрутах. */
  const routePaths = [...appTsx.matchAll(/<Route\s+path="([^"]+)"/g)].map(([, p]) => p)

  it('разбор видит маршруты', () => {
    expect(routePaths.length).toBeGreaterThan(10)
  })

  it('ни один маршрут не остался без решения', () => {
    const missing = routePaths.filter((p) => !(p in ROUTE_INDEXING))
    expect(
      missing,
      `новый экран обязан получить решение в src/domain/routeIndexing.ts:\n  ${missing.join('\n  ')}\n` +
        `умолчания нет намеренно — молчание здесь значит «пустить поисковика куда попало»`,
    ).toEqual([])
  })

  it('в решениях не осталось маршрутов, которых больше нет', () => {
    const stale = Object.keys(ROUTE_INDEXING).filter((p) => !routePaths.includes(p))
    expect(stale, `маршрут удалён, а решение осталось:\n  ${stale.join('\n  ')}`).toEqual([])
  })
})

describe('карта сайта и robots.txt', () => {
  const robots = robotsTxt(SITE_URL)
  const sitemap = sitemapXml(SITE_URL, '2026-09-21')

  it('личные разделы закрыты от обхода', () => {
    for (const path of ['/profile', '/my-items', '/my-rentals', '/admin']) {
      expect(robots, `${path} обязан быть закрыт`).toContain(`Disallow: ${path}`)
    }
  })

  /**
   * В адресе `/reset-password` приезжает одноразовый токен из письма.
   * Такому адресу в индексе не место ни при каких условиях.
   */
  it('страница смены пароля по ссылке из письма закрыта', () => {
    expect(robots).toContain('Disallow: /reset-password')
  })

  it('в robots.txt нет путей с параметром — они ничего не закрывают', () => {
    expect(disallowedRoutes().filter((p) => p.includes(':'))).toEqual([])
  })

  it('карта ведёт на наш домен, а не на чужой', () => {
    expect(sitemap).toContain(`<loc>${SITE_URL}/</loc>`)
    expect(sitemap.includes('rentit.be')).toBe(false)
    expect(SITE_DOMAIN).not.toBe('rentit.be')
  })

  it('в карту попали только открытые страницы', () => {
    for (const path of ['/profile', '/admin', '/login', '/item/:id']) {
      expect(sitemap, `${path} в карте быть не должен`).not.toContain(`${SITE_URL}${path}<`)
    }
  })
})

describe('манифест описывает установку по-настоящему', () => {
  it('на языке продукта, а не по-английски', () => {
    expect(manifest.lang).toBe('fr-BE')
    // «Rent anything from your neighbors» висело на французском
    // продукте и показывалось при установке на домашний экран.
    expect(manifest.description).toMatch(/[àâçéèêëîïôûù]/)
  })

  it('есть отдельная maskable-иконка', () => {
    // Одна иконка с `purpose: "any maskable"` — распространённая ошибка:
    // Android режет её своей формой, и угловая метка исчезает. Под маску
    // нужен свой файл с полями.
    const maskable = manifest.icons.filter((i: { purpose?: string }) => i.purpose === 'maskable')
    expect(maskable.length).toBeGreaterThanOrEqual(1)
    const any = manifest.icons.filter((i: { purpose?: string }) => i.purpose === 'any')
    expect(any.length).toBeGreaterThanOrEqual(2)
  })

  it('цвета — из действующей палитры', () => {
    // #080808 и #F2F0EB сняты 12.08 вместе со всей палитрой.
    expect(manifest.theme_color).toBe('#121417')
    expect(manifest.background_color).toBe('#F1F3F5')
  })

  it('ярлыки ведут на существующие маршруты', () => {
    for (const s of manifest.shortcuts as Array<{ url: string }>) {
      expect(s.url in ROUTE_INDEXING, `ярлык ведёт на ${s.url}, а такого маршрута нет`).toBe(true)
    }
  })
})

describe('объявленные языковые версии существуют на самом деле', () => {
  /**
   * `hreflang` — ОБЕЩАНИЕ, а не украшение.
   *
   * index.html объявляет три языковые версии по адресам `?lang=fr|nl|en`.
   * До 21.09 параметр не читал никто: язык брался только из localStorage,
   * и по всем трём адресам отдавалась французская страница. Поисковик шёл
   * за нидерландской версией и получал французскую.
   *
   * Сторож связывает две стороны обещания: если в шапке объявлен язык,
   * продукт обязан уметь его показать по этому адресу.
   */
  const declared = [...indexHtml.matchAll(/hreflang="([^"]+)"\s+href="%SITE_URL%\/\?lang=([^"]+)"/g)]
    .map(([, hreflang, param]) => ({ hreflang, param }))

  const i18nSource = read('src/i18n-next.ts')

  it('объявления вообще есть', () => {
    expect(declared.length).toBeGreaterThanOrEqual(3)
  })

  it('параметр совпадает с объявленным языком', () => {
    const mismatched = declared.filter((d) => d.hreflang !== d.param)
    expect(mismatched, `hreflang и ?lang= расходятся: ${JSON.stringify(mismatched)}`).toEqual([])
  })

  it('продукт читает язык из адреса', () => {
    // Без этого каждое объявление выше — ложь для поисковика.
    expect(i18nSource).toMatch(/URLSearchParams\([^)]*\)\.get\('lang'\)/)
  })

  it('каждый объявленный язык продукт поддерживает', () => {
    const supported = i18nSource.match(/export const LANGUAGES = \[([^\]]+)\]/)?.[1] ?? ''
    for (const { hreflang } of declared) {
      if (hreflang === 'x-default') continue
      expect(supported, `объявлен ${hreflang}, а в LANGUAGES его нет`).toContain(`'${hreflang}'`)
    }
  })

  it('атрибут lang у документа следует за выбором', () => {
    // `<html lang="fr">` не менялся никогда: программа чтения с экрана
    // произносила нидерландский текст французскими звуками.
    expect(i18nSource).toContain('documentElement.lang')
  })
})
