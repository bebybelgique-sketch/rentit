// src/lib/referral.ts
//
// Приглашение соседа: код из ссылки ?ref=… и ссылки со своим кодом.
//
// ЗАЧЕМ ЛОВИТЬ ПРИ ЗАПУСКЕ. Ссылку присылают на витрину или на объявление,
// а регистрация — через два-три экрана. До 24.09 код читала только
// страница /register из собственного адреса: пришедший по ссылке на
// объявление и нажавший «S'inscrire» терял приглашение на первом же
// переходе.
//
// ПОЧЕМУ В ПАМЯТИ, А НЕ В ХРАНИЛИЩЕ. Приложение одностраничное: переходы
// внутри вкладки модуль не перезагружают, и значения в памяти хватает на
// путь «ссылка → регистрация». Запись на устройство ради учёта приглашений
// — не то, без чего сайт не работает, и потребовала бы согласия. Закрыл
// вкладку и вернулся позже — приглашение не засчитано; эта цена меньше.
//
// ПОЧЕМУ КОД УБИРАЕТСЯ ИЗ АДРЕСА. Иначе пришедший по чужой ссылке
// поделился бы дальше адресом с ЧУЖИМ кодом из строки браузера.
//
// Код проверяет и ищет сервер (триггер регистрации, миграция 43). Здесь
// только форма: восемь шестнадцатеричных знаков, как их выдаёт
// generate_referral_code.

const REF_PARAM = 'ref'
const CODE = /^[0-9A-F]{8}$/

let pending: string | null = null

/** Код в том виде, в каком его хранит база, или null, если это не код. */
export function normalizeReferral(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return CODE.test(code) ? code : null
}

/**
 * Запомнить код из адреса и убрать его из строки браузера. Вызывается
 * один раз при запуске, ДО маршрутизатора: тот читает уже чистый адрес.
 */
export function captureReferral(win: Window = window): void {
  const url = new URL(win.location.href)
  if (!url.searchParams.has(REF_PARAM)) return
  const code = normalizeReferral(url.searchParams.get(REF_PARAM))
  if (code) pending = code
  url.searchParams.delete(REF_PARAM)
  win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash)
}

/** Код приглашения, с которым человек пришёл в эту вкладку. */
export function pendingReferral(): string | null {
  return pending
}

/** Ссылка с кодом приглашения; без кода — та же ссылка без чужого кода. */
export function withReferral(href: string, code: string | null | undefined): string {
  const url = new URL(href)
  url.searchParams.delete(REF_PARAM)
  const valid = normalizeReferral(code)
  if (valid) url.searchParams.set(REF_PARAM, valid)
  return url.toString()
}

/** Только для тестов. */
export function forgetReferralForTests(): void {
  pending = null
}
