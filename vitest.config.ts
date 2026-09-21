// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], // Не забываем плагин для JSX
  // Юнит-прогон НЕ ВИДИТ .env — и это нарочно.
  //
  // lib/supabase бросает при загрузке модуля без VITE_SUPABASE_URL. На
  // машине разработчика .env есть, в CI его нет, поэтому тест, забывший
  // заглушить supabase, зеленел локально и валил прогон в CI. Так было
  // ТРИЖДЫ: 06d9ded, PR #75, PR #95 — и каждый раз находка приходила из
  // CI, а не с машины.
  //
  // envDir указывает в пустую папку: локально теперь ровно те же условия,
  // что на сервере. Playwright читает .env своим загрузчиком, его это не
  // касается — см. src/test/no-env/README.md.
  envDir: "./src/test/no-env",

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