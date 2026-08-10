// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Импортируем файлы переводов
import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

// Определяем ресурсы переводов
const resources = {
  en: { translation: en },
  fr: { translation: fr },
  nl: { translation: nl },
};

i18n
  .use(initReactI18next) // подключаем react-i18next
  .init({
    resources,
    lng: 'fr', // язык по умолчанию
    fallbackLng: 'en', // язык, который будет использоваться, если перевод отсутствует
    interpolation: {
      escapeValue: false, // react уже защищает от XSS
    },
  });

export default i18n;