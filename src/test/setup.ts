// src/test/setup.ts
import '@testing-library/jest-dom'; // Просто импортируем библиотеку, она автоматически расширяет expect
import { vi } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr.json';

// Без инициализации i18next компоненты рендерят не текст, а сами ключи
// ('profile.updateButton'), и любой тест, ищущий надпись на экране, падает.
// Поднимаем ту же французскую локаль, что и в приложении.
i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

// Мокаем window.matchMedia, так как он не доступен в jsdom по умолчанию
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Устаревший метод, но может использоваться библиотеками
    removeListener: vi.fn(), // Устаревший метод, но может использоваться библиотеками
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});