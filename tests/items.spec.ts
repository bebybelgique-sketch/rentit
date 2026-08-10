import { test, expect } from '@playwright/test'

async function dismissCookies(page: any) {
  await page.waitForTimeout(800)
  try {
    const btn = page.getByRole('button', { name: 'Accept all cookies' })
    if (await btn.isVisible({ timeout: 3000 })) await btn.click()
  } catch { /* already dismissed */ }
}

test.describe('Items', () => {
  test('browse shows seeded items', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(3000)
    const cards = page.locator('.item-card')
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('item card shows title and price', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(3000)
    const card = page.locator('.item-card').first()
    await expect(card).toBeVisible({ timeout: 8000 })
    await expect(card.locator('.item-card-title')).toBeVisible()
    await expect(card.locator('.item-card-price')).toBeVisible()
  })

  test('item detail page loads from browse', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(3000)
    const card = page.locator('.item-card').first()
    await expect(card).toBeVisible({ timeout: 8000 })
    await card.click()
    await expect(page).toHaveURL(/\/item\//, { timeout: 5000 })
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 8000 })
  })

  test('category filter Power Tools shows results', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: /Power Tools/i }).click()
    await page.waitForTimeout(1500)
    const cards = page.locator('.item-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('category filter Garden shows results', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: /Garden/i }).click()
    await page.waitForTimeout(1500)
    const cards = page.locator('.item-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('map view toggle shows map', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(2000)
    const mapBtn = page.getByRole('button', { name: /map/i })
    if (await mapBtn.isVisible({ timeout: 3000 })) {
      await mapBtn.click()
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 })
    }
  })
})
