// src/test/setup.ts
import '@testing-library/jest-dom'; // Просто импортируем библиотеку, она автоматически расширяет expect
import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from 'i18next';

// ОЖИДАНИЕ НЕ ДОЛЖНО СДАВАТЬСЯ РАНЬШЕ, ЧЕМ САМ ТЕСТ.
//
// У `waitFor` из testing-library свой таймаут, по умолчанию ОДНА секунда.
// У vitest свой — пять. То есть проверка внутри теста объявляла провал
// вчетверо раньше, чем тест считался зависшим, и эту разницу машина под
// нагрузкой съедает легко: 14.08 полный прогон юнит-тестов здесь
// растянулся до 41 минуты, а 19.09 `useBrowseItems > точка посетителя`
// упал один раз в полном наборе и не воспроизвёлся ни в одиночку
// (17/17), ни на повторе всего набора (374/374). В хуке нет ни одного
// таймера, мок разрешается сразу — гонке взяться неоткуда.
//
// Это ЛУЧШЕЕ ОБЪЯСНЕНИЕ, а не пойманная за руку причина. Но выбор между
// «иногда красный без повода» и «зависший тест живёт на две секунды
// дольше» очевиден в одну сторону: мерцающий гейт перестают читать
// целиком, и настоящее падение тонет в нём.
//
// Потолок остаётся: три секунды МЕНЬШЕ пятисекундного таймаута vitest,
// поэтому по-настоящему зависший тест по-прежнему падает. Спрятать
// зависание это значение не может — для этого оно должно быть >= 5000.
configure({ asyncUtilTimeout: 3000 });
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