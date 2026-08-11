import { test, expect } from '@playwright/test'
import { UI, dismissCookies, skipModals } from './helpers/app'

test.describe('вход и защищённые страницы', () => {
  test('страница входа отдаёт форму', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    await dismissCookies(page)

    await expect(page.getByRole('heading', { name: UI.loginHeading })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('неверная пара показывает ошибку, а не молчит', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    await dismissCookies(page)

    await page.locator('input[type="email"]').fill('nobody@rentit-e2e.local')
    await page.locator('input[type="password"]').fill('заведомо-неверный-пароль')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 15000 })
    // И человек остаётся на странице входа, а не улетает в никуда.
    await expect(page).toHaveURL(/\/login/)
  })

  test('страница регистрации отдаёт форму', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('страница восстановления пароля отдаёт форму', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
  })

  // Гостя со страниц кабинета уводит на вход. Проверяем каждую отдельно:
  // маршруты объявлены по одному, и сломаться может любой из них.
  for (const path of ['/list-item', '/my-items', '/my-rentals', '/profile']) {
    test(`гостя с ${path} уводит на вход`, async ({ page }) => {
      await skipModals(page)
      await page.goto(path, { waitUntil: 'load' })
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })
  }
})
