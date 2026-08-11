import { defineConfig, devices } from '@playwright/test'

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
