import { test, expect } from '@playwright/test'
import { login, dismissCookies } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''
const RENTER_EMAIL = process.env.TEST_RENTER_EMAIL ?? ''
const RENTER_PASSWORD = process.env.TEST_RENTER_PASSWORD ?? ''

/**
 * Даты брони — без мыши (аудит 04.10). Дни календаря были <div> с onClick:
 * ни фокуса, ни Enter. Критерий приёмки: выбрать даты всей брони
 * клавиатурой — Enter на дне, Tab к следующему доступному, Enter.
 */
test.describe('календарь с клавиатуры', () => {
  test.describe.configure({ timeout: 150_000 })

  test.skip(
    !OWNER_EMAIL || !OWNER_PASSWORD || !RENTER_EMAIL || !RENTER_PASSWORD,
    'Нет учёток в окружении: заполните TEST_OWNER_* и TEST_RENTER_* в .env',
  )

  let item: CreatedItem | null = null

  test.afterEach(async ({ page }) => {
    if (!item) return
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await removeItem(page, item.id)
    item = null
  })

  test('Enter — начало, Tab — следующий день, Enter — конец', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E календарь') })

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await page.goto(item.href, { waitUntil: 'load' })
    await dismissCookies(page)

    await page.getByRole('button', { name: 'Mois suivant' }).press('Enter')
    const days = page.locator('button.cal-day.available')
    await expect(days.first()).toBeVisible({ timeout: 15000 })

    await days.first().focus()
    await page.keyboard.press('Enter')
    await expect(days.first()).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(days.nth(1)).toHaveAttribute('aria-pressed', 'true')

    await expect(page.getByText('2 jours', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Total estimé', { exact: true })).toBeVisible()
  })
})
