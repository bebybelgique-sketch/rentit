// src/i18n-next.ts
//
// ЕДИНСТВЕННАЯ система переводов. До 12.08 их было две: react-i18next держал
// навбар, MyRentals и Profile, а самописная src/i18n/ — витрину, страницу
// вещи, выкладку, вход и регистрацию. Никто так не решал: вторую принесли
// вторым заходом Qwen (коммит 4d553c2 «довести до собираемого состояния»),
// довели до сборки и первую не убрали.
//
// Цена раскола была видна человеку: кнопка EN переключала навбар, но не тело
// страницы; до нидерландского из интерфейса было не добраться вовсе; навбар
// говорил «Mes articles», а заголовок той же страницы — «Mes outils».
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

export const LANGUAGES = ['fr', 'en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'rentit_lang';

// Выбор языка обязан пережить перезагрузку. Самописная система его хранила,
// react-i18next был настроен на жёсткое lng: 'fr' — при сведении это молча
// потерялось бы, и человек возвращался бы во французский на каждой странице.
function storedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGUAGES as readonly string[]).includes(saved)) return saved as Language;
  } catch {
    /* приватный режим — переживём без сохранения */
  }
  return 'fr';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      nl: { translation: nl },
    },
    lng: storedLanguage(),
    // Основной язык продукта французский: если ключ потеряется, честнее
    // показать французский текст, чем английский посреди французской страницы.
    fallbackLng: 'fr',
    interpolation: { escapeValue: false }, // react уже защищает от XSS
  });

i18n.on('languageChanged', lang => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* приватный режим */
  }
});

export default i18n;
