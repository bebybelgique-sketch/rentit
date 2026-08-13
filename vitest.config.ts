// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], // Не забываем плагин для JSX
  test: {
    globals: true, // Позволяет использовать describe, it, expect глобально
    environment: 'jsdom', // Используем jsdom для эмуляции DOM
    setupFiles: './src/test/setup.ts', // Файл для настройки тестовой среды
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      // Логика edge-функций, которую можно проверить без Deno и без выкатки
      // в прод. Пока сюда не заглядывали, единственный код, удаляющий чужие
      // файлы, не был покрыт ничем.
      'supabase/functions/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
  },
});