// src/lib/consent.ts
//
// Выбор человека в баннере (CookieBanner.tsx) — одно место чтения.
//
// До 06.10 выбор только записывался: ни одна строка кода его не читала, и
// переключатель «Analytique» ни на что не влиял. С дневными счётчиками
// (usage.ts) он впервые что-то решает, а значит его должно быть можно и
// ИЗМЕНИТЬ: отозвать согласие так же просто, как дать (GDPR, ст. 7(3)).
// Для этого — событие «открыть настройки», которое слушает баннер.

/** Ключ не менять: на него завязаны снимки страниц и прогоны Playwright. */
export const CONSENT_KEY = 'rentit_cookie_consent'

export type Consent = { necessary: true; functional: boolean; analytics: boolean }

/** Сохранённый выбор или null, если человек ещё не выбирал (или запись испорчена). */
export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Consent> | null
    return value && typeof value.analytics === 'boolean' && typeof value.functional === 'boolean'
      ? { necessary: true, functional: value.functional, analytics: value.analytics }
      : null
  } catch {
    // Приватный режим, запрет хранилища, испорченный JSON — выбора нет.
    return null
  }
}

export const OPEN_COOKIE_PREFERENCES = 'rentit:open-cookie-preferences'

/** Открыть баннер на настройках — из подвала и из политики конфиденциальности. */
export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES))
}
