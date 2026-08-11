import { test, expect } from '@playwright/test'
import { login, dismissCookies, UI } from './helpers/app'
import { createItem, removeItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''

/**
 * Проверка самой оснастки, а не продукта.
 *
 * Остальные сценарии стоят на createItem/removeItem, и если оснастка сломана,
 * они упадут все разом с невнятной причиной. Пусть причина называется здесь.
 */
test.describe('оснастка', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Нет учётки владельца в окружении')

  test('заводит объявление через интерфейс и убирает его за собой', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)

    const item = await createItem(page, { title: 'E2E оснастка', pricePerDay: '9.50' })
    expect(item.id).toBeTruthy()

    // Вещь видна владельцу в своём кабинете.
    await page.goto('/my-items', { waitUntil: 'load' })
    await dismissCookies(page)
    const card = page.locator('.card').filter({ has: page.locator(`a[href="${item.href}"]`) })
    await expect(card).toBeVisible({ timeout: 15000 })
    await expect(card).toContainText(item.title)

    await removeItem(page, item.id)

    // И после уборки её там нет — иначе прогоны копят мусор в базе.
    await page.goto('/my-items', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(
      page.locator('.card').filter({ has: page.locator(`a[href="${item.href}"]`) }),
    ).toHaveCount(0, { timeout: 15000 })
    void UI
  })
})
