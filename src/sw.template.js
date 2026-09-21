/* eslint-disable no-undef */
//
// Service worker. ШАБЛОН: версию кэша и список предзагрузки подставляет
// сборка (плагин в vite.config.ts), потому что имена файлов содержат
// хеш и меняются с каждым выкатом.
//
// ── ЧТО ЗДЕСЬ БЫЛО ДО 21.09 ──────────────────────────────────────────
//
// В public/sw.js лежал воркер, который НЕ БЫЛ ЗАРЕГИСТРИРОВАН НИГДЕ —
// мёртвый файл. И хорошо, что не был: он перехватывал ВСЕ GET-запросы,
// включая обращения к базе, а без сети отвечал
//
//     fetch(req).catch(() => caches.match(req))
//
// то есть `undefined`, когда в кэше пусто. `respondWith(undefined)`
// бросает, и человек получал сломанный запрос вместо честной ошибки.
// Плюс кэшировал только '/' и '/index.html', не трогая код приложения:
// офлайн загрузилась бы пустая оболочка без единого скрипта.
//
// ── ПОЧЕМУ ВООБЩЕ ВОРКЕР ─────────────────────────────────────────────
//
// Без него приложение нельзя поставить на телефон (Chrome требует
// обработчик fetch), и без сети человек видит страницу ошибки браузера,
// а не продукт. Замер до правки:
//
//     зарегистрированных service worker: 0
//     переход без сети: net::ERR_INTERNET_DISCONNECTED
//     что на экране: (страницы нет)
//
// ── ПРАВИЛА, КОТОРЫЕ ТУТ ДЕЙСТВУЮТ ───────────────────────────────────
//
// 1. ЧУЖОЕ НЕ ТРОГАЕМ ВООБЩЕ. Запросы не на наш домен (Supabase прежде
//    всего) проходят мимо воркера. Отдать из кэша вчерашний ответ базы
//    хуже, чем не ответить: человек увидит несуществующую бронь и будет
//    ей верить.
//
// 2. ПЕРЕХОДЫ — СЕТЬ ПЕРВОЙ. Только если сети нет, отдаём сохранённый
//    index.html. Обратный порядок (кэш первым) означал бы, что после
//    выката человек с открытой вкладкой получает старую страницу со
//    ссылками на файлы, которых на сервере уже нет.
//
// 3. ФАЙЛЫ СБОРКИ — КЭШ ПЕРВЫМ. В их именах хеш содержимого: адрес
//    меняется вместе с содержимым, поэтому устареть они не могут.
//
// 4. НИКАКОГО skipWaiting. Новый воркер ждёт, пока закроются вкладки со
//    старым. Подмена воркера под открытой страницей меняет правила
//    выдачи посреди сессии — ради минуты свежести это скверный размен.
//
// 5. АВАРИЙНЫЙ ВЫХОД. По сообщению 'unregister' воркер стирает кэши и
//    снимает себя. Воркер — штука липкая: без такого рычага ошибка в нём
//    чинится только у тех, кто сам догадается чистить данные сайта.

const VERSION = '__VERSION__'
const CACHE = `rentit-${VERSION}`
const PRECACHE = __PRECACHE__

const SHELL = '/index.html'

/**
 * Как ищем в кэше.
 *
 * `ignoreVary` — НЕ ПЕРЕСТРАХОВКА. Без него офлайн не работал вовсе, и
 * выглядело это издевательски: в кэше лежали РОВНО те файлы, которые
 * страница просила, имя в имя —
 *
 *   в кэше:    /assets/index-u_axv-YY.js
 *   не доехало: net::ERR_FAILED /assets/index-u_axv-YY.js
 *
 * Причина в том, что совпадение по умолчанию учитывает заголовок
 * `Vary` ответа: сервер отдаёт `Vary: Accept-Encoding`, а запрос при
 * установке (`cache: reload`) и запрос страницы шлют разный
 * `Accept-Encoding` — и один и тот же файл считается разным.
 *
 * Нам это различие не нужно: адреса файлов сборки содержат хеш
 * содержимого, и двух разных ответов по одному адресу не бывает.
 */
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // `reload` — чтобы оболочка бралась с сервера, а не из HTTP-кэша
      // браузера, где может лежать предыдущая сборка.
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))
    ),
  )
  // skipWaiting здесь НЕТ намеренно — см. правило 4 в шапке.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'unregister') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister()),
    )
  }
})

/** Файл сборки: имя содержит хеш, значит содержимое неизменно. */
const isBuildAsset = (url) => url.pathname.startsWith('/assets/')

/** Своё статическое: шрифты, иконки, картинки, манифест. */
const isStatic = (url) =>
  /\.(woff2?|png|jpe?g|svg|webp|ico|json|txt|xml)$/i.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Только GET. Всё остальное — записи, их кэшировать нельзя ни в каком
  // виде.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // ПРАВИЛО 1: чужой домен не наш. Supabase, карты, что угодно — мимо.
  if (url.origin !== self.location.origin) return

  // ПРАВИЛО 2: переходы — сеть первой, кэшированная оболочка запасной.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Свежую оболочку кладём в кэш: следующий раз без сети человек
          // увидит актуальную, а не ту, что была на установке.
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((c) => c.put(SHELL, copy))
          }
          return response
        })
        .catch(() => caches.match(SHELL, MATCH).then((cached) =>
          // Оболочка попадает в кэш при установке, поэтому промаха здесь
          // быть не должно. Но `respondWith(undefined)` бросает, а
          // брошенный запрос показывается как поломка сети — то есть
          // ровно то, от чего уходим. Отдаём честный ответ.
          cached ?? new Response('', { status: 503, statusText: 'Offline' })
        )),
    )
    return
  }

  // ПРАВИЛО 3: файлы сборки — кэш первым.
  if (isBuildAsset(url) || isStatic(url)) {
    event.respondWith(
      caches.match(request, MATCH).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          // В кэш идёт только то, что сервер отдал успешно. Ответ 404
          // или прокси-заглушка, положенные в кэш, остаются там до
          // следующего выката.
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return response
        })
      }),
    )
    return
  }

  // Всё прочее своё — обычной сетью, без участия воркера.
})
