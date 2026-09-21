// src/lib/registerServiceWorker.ts
//
// Постановка воркера — отдельным файлом и с оговорками.
//
// ── ЗАЧЕМ ────────────────────────────────────────────────────────────
//
// До 21.09 воркер лежал в public/ и не регистрировался НИГДЕ. Следствий
// два: приложение нельзя поставить на телефон (Chrome требует живой
// обработчик fetch), и без сети человек видел страницу ошибки браузера.
// Замер: «зарегистрированных service worker: 0».
//
// ── ПОЧЕМУ ТОЛЬКО В ПРОДЕ ────────────────────────────────────────────
//
// В `vite dev` модули отдаются по одному и без хешей, а воркер сделал бы
// их кэш липким: правка в редакторе перестала бы доезжать до браузера.
// Ловить это потом в чужой голове («у меня не обновляется») — худший из
// способов потратить день.
//
// ── ПОЧЕМУ ПОСЛЕ ЗАГРУЗКИ ────────────────────────────────────────────
//
// Регистрация тянет и разбирает файл воркера, а затем он скачивает всю
// предзагрузку. На первом заходе это соревнование за ту же сеть, по
// которой едет сама страница. Ждём `load` — тогда предзагрузка идёт в
// тишине после того, как человек уже что-то видит.

/** Адрес воркера. Собирается сборкой (плагин в vite.config.ts). */
const SW_URL = '/sw.js'

/**
 * Снять воркер и стереть его кэши.
 *
 * АВАРИЙНЫЙ РЫЧАГ, и он здесь не для красоты. Воркер липкий: он
 * переживает обновление страницы и продолжает отвечать из кэша. Ошибка в
 * нём чинится не выкатом, а только у тех, кто сам догадается стереть
 * данные сайта. Поэтому способ снять его обязан существовать ДО того,
 * как понадобится.
 *
 * Вызывается из консоли: `window.__rentitUnregisterSW()`.
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  for (const registration of registrations) {
    registration.active?.postMessage('unregister')
    await registration.unregister()
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  // `import.meta.env.PROD` — правда только в собранном коде.
  if (!import.meta.env.PROD) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL).catch((error) => {
      // Отказ регистрации — не повод ломать приложение: без воркера оно
      // работает ровно так же, только без офлайна. В консоль, не человеку.
      console.error('[sw] регистрация не удалась:', error)
    })
  })

  // Рычаг доступен всегда, даже если регистрация не прошла: чинить
  // приходится как раз тогда, когда что-то пошло не так.
  ;(window as unknown as Record<string, unknown>).__rentitUnregisterSW = unregisterServiceWorker
}
