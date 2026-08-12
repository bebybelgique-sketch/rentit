import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Учётки для сквозных сценариев лежат в .env, но Playwright сам его не читает:
// 11.08 из-за этого booking-journey не падал, а МОЛЧА пропускался — набор
// показывал «14 passed», и единственный сценарий про цикл аренды в это число
// не входил вовсе. Пропуск и провал выглядят в отчёте почти одинаково, поэтому
// переменные подгружаем здесь, до объявления тестов.
// Зависимость dotenv ради шести строк не заводим: разбор простой, а любой новый
// пакет в публичном репозитории — это ещё одна вещь, которую надо обновлять.
function loadEnvFile() {
  const here = dirname(fileURLToPath(import.meta.url))
  let raw: string
  try {
    raw = readFileSync(resolve(here, '.env'), 'utf8')
  } catch {
    return // .env нет — это нормально: на CI переменные приходят из окружения
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue // комментарии и пустые строки
    const [, key, rawValue] = match
    // Уже заданное окружение сильнее файла: так прогон против другого
    // развёртывания не приходится делать правкой .env.
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadEnvFile()

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 1,
  use: {
    // Прежний адрес (project-gamma-one-36) отдавал 404 с мая: любой прогон
    // падал на первой навигации, и «тесты зелёные» означало только, что их
    // не запускали. Адрес вынесен в переменную, чтобы смена развёртывания
    // больше не хоронила весь набор молча.
    baseURL: process.env.E2E_BASE_URL || 'https://rentit-plum.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
