// src/test/setup.ts
import '@testing-library/jest-dom'; // Просто импортируем библиотеку, она автоматически расширяет expect
import { vi } from 'vitest';

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