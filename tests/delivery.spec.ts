import { test, expect, type Page } from '@playwright/test'
import { login, dismissCookies } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''
const RENTER_EMAIL = process.env.TEST_RENTER_EMAIL ?? ''
const RENTER_PASSWORD = process.env.TEST_RENTER_PASSWORD ?? ''

const FEE = 15
const PRICE_PER_DAY = '10.00'

/**
 * Доставка глазами обеих сторон.
 *
 * Прогон edge-функций (supabase/tests/edge-functions.mjs) уже доказал
 * серверную половину: снимок цены берётся из вещи, доставка не входит в
 * total_price, чужая услуга отклоняется. Чего он не видит — интерфейса:
 * появляется ли галка у владельца, доходит ли выбор арендатора до суммы и
 * до брони. Ровно этот разрыв здесь и закрывается.
 */
async function selectBookingRange(page: Page) {
  const nextMonth = page.locator('button').filter({ hasText: '›' }).first()
  if (await nextMonth.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextMonth.click()
  }
  const availableDays = page.locator('.cal-day.available').filter({ hasText: /\d+/ })
  await expect(availableDays.first()).toBeVisible({ timeout: 15000 })
  expect(await availableDays.count()).toBeGreaterThanOrEqual(2)
  await availableDays.nth(0).click()
  await availableDays.nth(1).click()
}

/**
 * Итог читаем по подписи и соседнему значению, а не по «последнему числу на
 * странице»: на карточке вещи цен несколько, и любая из них годится в
 * ложноположительный ответ.
 */
async function readTotal(page: Page): Promise<number> {
  const value = page.getByText('Total estimé', { exact: true }).locator('xpath=following-sibling::span[1]')
  await expect(value).toBeVisible({ timeout: 15000 })
  const text = (await value.innerText()).replace(/[^\d.,]/g, '').replace(',', '.')
  const n = Number(text)
  expect(Number.isFinite(n), `итог не разобрался: "${text}"`).toBeTruthy()
  return n
}

test.describe('доставка', () => {
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

  test('владелец объявляет доставку, арендатор выбирает её и видит в брони', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, {
      title: uniqueTitle('E2E доставка'),
      pricePerDay: PRICE_PER_DAY,
      delivery: { fee: FEE.toFixed(2), radiusKm: '10' },
    })

    // Условие объявлено — оно обязано быть видно на самой вещи, иначе
    // арендатор узнает о доставке только при встрече.
    await expect(page.getByText(/Livraison €15[.,]00/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/jusqu'à 10 km/)).toBeVisible({ timeout: 10000 })

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await page.goto(item.href, { waitUntil: 'load' })
    await dismissCookies(page)
    await selectBookingRange(page)

    const before = await readTotal(page)
    // Строки доставки в расчёте до выбора быть НЕ должно: услуга, молча
    // добавленная в счёт, — это сумма, о которой узнают при встрече.
    await expect(page.getByText('Livraison', { exact: true })).toHaveCount(0)

    const box = page.locator('#wants-delivery')
    await expect(box).toBeVisible({ timeout: 10000 })
    await box.check()

    await expect(page.getByText('Livraison', { exact: true })).toBeVisible({ timeout: 10000 })
    const after = await readTotal(page)
    expect(after - before, `итог изменился на ${after - before} вместо ${FEE}`).toBeCloseTo(FEE, 2)

    await page.locator('textarea').fill('Livraison souhaitée, merci.')
    await page.getByRole('button', { name: /Envoyer une demande de réservation/i }).click()
    await expect(page.getByText(/[Dd]emande envoyée/)).toBeVisible({ timeout: 20000 })

    // И в брони — то же число. Показывается оно из снимка, а не из вещи.
    await page.goto('/my-rentals', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(async () => {
      await page.waitForLoadState('networkidle', { timeout: 15000 })
      await expect(page.getByText('Chargement...')).toHaveCount(0)
    }).toPass({ timeout: 45000 })
    await expect(page.getByText(/Livraison:\s*€15[.,]00/).first()).toBeVisible({ timeout: 15000 })
  })

  test('у вещи без объявленной доставки выбора нет', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E без доставки'), pricePerDay: PRICE_PER_DAY })

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await page.goto(item.href, { waitUntil: 'load' })
    await dismissCookies(page)
    await selectBookingRange(page)

    // Ни галки, ни упоминания: услуги не существует, пока владелец её не
    // включил, и умолчание это обязано быть верным без единого действия.
    await expect(page.locator('#wants-delivery')).toHaveCount(0)
    await expect(page.getByText(/Livraison/)).toHaveCount(0)
  })
})
