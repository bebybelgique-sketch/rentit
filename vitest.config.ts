// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], // Не забываем плагин для JSX
  test: {
    globals: true, // Позволяет использовать describe, it, expect глобально
    environment: 'jsdom', // Используем jsdom для эмуляции DOM
    setupFiles: './src/test/setup.ts', // Файл для настройки тестовой среды
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], // Паттерн для поиска файлов тестов
  },
});