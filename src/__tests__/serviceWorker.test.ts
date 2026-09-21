import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Service worker: правила, которые нельзя нарушить молча.
 *
 * ── ЧЕМУ УЧИТ ИСТОРИЯ ЭТОГО ФАЙЛА ────────────────────────────────────
 *
 * В public/sw.js с марта лежал воркер, НЕ ЗАРЕГИСТРИРОВАННЫЙ НИГДЕ. И
 * хорошо, что не был: он перехватывал ВСЕ GET-запросы, включая
 * обращения к базе, кэшировал только '/' и '/index.html' — то есть ни
 * одного скрипта приложения, — а без сети отвечал `undefined`, отчего
 * запрос падал с ошибкой вместо честного ответа.
 *
 * При этом «воркер есть» — и всё выглядело сделанным.
 *
 * ── ПОЧЕМУ ПРОВЕРКИ ПО ИСХОДНИКУ, А НЕ ПО ПОВЕДЕНИЮ ──────────────────
 *
 * Воркер живёт в своём потоке, со своим `self`, `caches` и `clients`;
 * поднимать это в jsdom — значит проверять макет, а не продукт. Его
 * поведение замерено в браузере (Playwright, режим offline), и результат
 * записан в PR. Здесь стережётся то, что при таком замере легко
 * пропустить: правила, которые видно только в тексте.
 */

const root = process.cwd()
const template = readFileSync(join(root, 'src', 'sw.template.js'), 'utf8')

describe('правила воркера', () => {
  /**
   * ГЛАВНОЕ ПРАВИЛО. Отдать из кэша вчерашний ответ базы хуже, чем не
   * ответить: человек увидит несуществующую бронь и будет ей верить.
   */
  it('чужой домен не трогает вовсе', () => {
    expect(template).toContain('url.origin !== self.location.origin')
    // И выходит СРАЗУ, без respondWith: запрос идёт обычной сетью.
    const at = template.indexOf('url.origin !== self.location.origin')
    const nextLines = template.slice(at, at + 120)
    expect(nextLines).toMatch(/return/)
  })

  it('записи не кэшируются никогда', () => {
    expect(template).toContain("request.method !== 'GET'")
  })

  /**
   * Кэш первым для переходов означал бы, что после выката человек с
   * открытой вкладкой получает старую страницу со ссылками на файлы,
   * которых на сервере уже нет.
   */
  it('переходы — сеть первой, кэш запасным', () => {
    const at = template.indexOf("request.mode === 'navigate'")
    expect(at).toBeGreaterThan(0)
    const block = template.slice(at, at + 1400)
    expect(block.indexOf('fetch(request)')).toBeLessThan(block.indexOf('caches.match'))
  })

  /**
   * `respondWith(undefined)` бросает, и брошенный запрос показывается
   * как поломка сети — ровно то, от чего уходим. Именно так был устроен
   * прежний воркер.
   */
  it('на промах в кэше отвечает ответом, а не пустотой', () => {
    expect(template).toContain('new Response(')
    expect(template).not.toMatch(/catch\(\(\) => caches\.match\(\w+\)\)\s*\)/)
  })

  /**
   * Поиск по кэшу учитывает `Vary`, а сервер отдаёт
   * `Vary: Accept-Encoding`. Из-за этого офлайн не работал ВООБЩЕ, хотя
   * в кэше лежали ровно те файлы, что просила страница:
   *
   *   в кэше:     /assets/index-u_axv-YY.js
   *   не доехало: net::ERR_FAILED /assets/index-u_axv-YY.js
   */
  it('поиск в кэше не зависит от Vary', () => {
    expect(template).toContain('ignoreVary: true')
    // Оба места: и оболочка, и файлы сборки.
    expect(template.match(/caches\.match\([^)]*MATCH/g)?.length).toBe(2)
  })

  /**
   * Подмена воркера под открытой страницей меняет правила выдачи посреди
   * сессии. Ради минуты свежести это скверный размен.
   */
  it('не перехватывает управление у открытых вкладок', () => {
    expect(template).not.toContain('skipWaiting()')
  })

  /**
   * Воркер липкий: он переживает обновление страницы. Ошибка в нём
   * чинится не выкатом, а только у тех, кто сам догадается стереть данные
   * сайта. Рычаг обязан существовать ДО того, как понадобится.
   */
  it('умеет снять себя по команде', () => {
    expect(template).toContain("event.data === 'unregister'")
    expect(template).toContain('self.registration.unregister()')
  })
})

describe('что попадает в предзагрузку', () => {
  const built = join(root, 'dist', 'sw.js')

  /**
   * Пропуск разрешён ТОЛЬКО на машине разработчика.
   *
   * Проверки ниже смотрят на результат сборки, и без неё их пришлось бы
   * либо пропускать, либо заставлять всех собирать продукт перед
   * `vitest`. Пропуск удобен — и ровно им проверка убивается: в CI
   * сборка шла ПОСЛЕ тестов, `dist/` не существовало, и джоб был
   * зелёным, ни разу сюда не заглянув.
   *
   * Поэтому в CI отсутствие сборки — не повод пропустить, а провал.
   */
  it('в CI сборка обязана существовать до тестов', () => {
    if (!process.env.CI) return
    expect(
      existsSync(built),
      'dist/sw.js нет: шаг «Сборка» обязан идти ПЕРЕД шагом «Юнит-тесты» в .github/workflows/gates.yml',
    ).toBe(true)
  })

  it.runIf(existsSync(built))('собранный воркер знает код входа', () => {
    const sw = readFileSync(built, 'utf8')
    const list = sw.match(/const PRECACHE = (\[[\s\S]*?\n\])/)?.[1]
    expect(list, 'список предзагрузки не подставлен').toBeTruthy()
    const files: string[] = JSON.parse(list!)

    // РОВНО ЭТА ОШИБКА была в прежнем воркере: кэшировались '/' и
    // '/index.html', и ни одного скрипта. Офлайн открывалась пустая
    // оболочка — «страница есть, продукта нет».
    expect(
      files.some((f) => /^\/assets\/index-.*\.js$/.test(f)),
      'без кода входа офлайн покажет пустую оболочку',
    ).toBe(true)
    expect(files.some((f) => f.endsWith('.css')), 'без стилей экран будет голым').toBe(true)
    expect(files).toContain('/index.html')

    // Шрифты свои, с чужого сервера их не тянут (см. шапку index.css) —
    // значит без них офлайн текст поедет на системный.
    expect(files.some((f) => f.endsWith('.woff2'))).toBe(true)
  })

  it.runIf(existsSync(built))('версия кэша подставлена, а не осталась шаблоном', () => {
    const sw = readFileSync(built, 'utf8')
    expect(sw).not.toContain('__VERSION__')
    expect(sw).not.toContain('__PRECACHE__')
    expect(sw).toMatch(/const VERSION = '[a-z0-9]+'/)
  })
})

describe('постановка воркера', () => {
  const source = readFileSync(join(root, 'src', 'lib', 'registerServiceWorker.ts'), 'utf8')

  /**
   * В `vite dev` модули отдаются по одному и без хешей: воркер сделал бы
   * их кэш липким, и правка в редакторе перестала бы доезжать.
   */
  it('в разработке не ставится', () => {
    expect(source).toContain('import.meta.env.PROD')
  })

  /**
   * Регистрация тянет воркер, а он — всю предзагрузку. На первом заходе
   * это соревнование за ту же сеть, по которой едет страница.
   */
  it('ждёт загрузки страницы', () => {
    expect(source).toContain("window.addEventListener('load'")
  })

  it('отказ регистрации не ломает приложение', () => {
    expect(source).toMatch(/\.catch\(/)
  })
})
