import { test, expect, type Page } from '@playwright/test'
import { login, dismissCookies } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''
const RENTER_EMAIL = process.env.TEST_RENTER_EMAIL ?? ''
const RENTER_PASSWORD = process.env.TEST_RENTER_PASSWORD ?? ''

const OPERATOR_FEE = 160

/**
 * Оператор глазами арендатора. Дни работы оператора называет он сам:
 * значения по умолчанию нет (аудит 04.10), и пока дни не названы, в итоге
 * нет суммы оператора, а заявка не уходит. После отправки экран повторяет
 * выбор — оператор строкой, с днями.
 */
async function selectTwoDays(page: Page) {
  const nextMonth = page.locator('button').filter({ hasText: '›' }).first()
  if (await nextMonth.isVisible({ timeout: 3000 }).catch(() => false)) await nextMonth.click()
  const days = page.locator('.cal-day.available').filter({ hasText: /\d+/ })
  await expect(days.first()).toBeVisible({ timeout: 15000 })
  await days.nth(0).click()
  await days.nth(1).click()
}

async function readTotal(page: Page): Promise<number> {
  const value = page.getByText('Total estimé', { exact: true }).locator('xpath=following-sibling::span[1]')
  await expect(value).toBeVisible({ timeout: 15000 })
  return Number((await value.innerText()).replace(/[^\d.,]/g, '').replace(',', '.'))
}

test.describe('оператор', () => {
  // Бюджет — как у «доставки»: несколько входов и уборка в одном таймауте.
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

  test('дни оператора называет арендатор — без них заявка не уходит', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, {
      title: uniqueTitle('E2E оператор'),
      pricePerDay: '10.00',
      operator: { feePerDay: OPERATOR_FEE.toFixed(2) },
    })

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await page.goto(item.href, { waitUntil: 'load' })
    await dismissCookies(page)
    await selectTwoDays(page)
    const before = await readTotal(page)

    await page.locator('#wants-operator').check()
    await expect(page.getByText('Opérateur : jours à préciser')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#operator-days')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Indiquez les jours avec opérateur' })).toBeDisabled()
    expect(await readTotal(page), 'без дней оператор не входит в итог').toBeCloseTo(before, 2)

    await page.locator('#operator-days').fill('1')
    await expect(page.getByText('Opérateur €160.00 × 1 j')).toBeVisible({ timeout: 10000 })
    expect(await readTotal(page)).toBeCloseTo(before + OPERATOR_FEE, 2)

    await page.getByRole('button', { name: 'Envoyer une demande de réservation' }).click()
    await expect(page.getByText(/[Dd]emande envoyée/)).toBeVisible({ timeout: 20000 })
    const summary = page.getByTestId('sent-summary')
    await expect(summary.getByText('Opérateur (1 jour)')).toBeVisible({ timeout: 10000 })
    await expect(summary.getByText('€160', { exact: true })).toBeVisible()
    const sentTotal = Number((await page.getByTestId('sent-total').innerText()).replace(/[^\d.,]/g, '').replace(',', '.'))
    expect(sentTotal, 'итог на месте = «Total estimé» до отправки').toBeCloseTo(before + OPERATOR_FEE, 2)
  })
})
