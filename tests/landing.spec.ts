import { test, expect } from '@playwright/test'

async function dismissCookies(page: any) {
  await page.waitForTimeout(800)
  try {
    const btn = page.getByRole('button', { name: 'Accept all cookies' })
    if (await btn.isVisible({ timeout: 3000 })) await btn.click()
  } catch { /* already dismissed */ }
}

test.describe('Landing page', () => {
  test('loads hero text', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 8000 })
  })

  test('navbar has Browse link', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.getByRole('link', { name: 'Browse' }).first()).toBeVisible({ timeout: 8000 })
  })

  test('navbar shows Log in when not authenticated', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible({ timeout: 8000 })
  })

  test('profile selector appears after cookie consent', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Accept all cookies' }).click({ timeout: 8000 })
    await expect(page.getByText('Who are you?')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Individual' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Business' })).toBeVisible()
  })

  test('profile Individual goes to browse', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Accept all cookies' }).click({ timeout: 8000 })
    await page.getByRole('button', { name: 'Individual' }).click({ timeout: 5000 })
    await expect(page).toHaveURL('/browse', { timeout: 5000 })
  })

  test('profile Business goes to business page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Accept all cookies' }).click({ timeout: 8000 })
    await page.getByRole('button', { name: 'Business' }).click({ timeout: 5000 })
    await expect(page).toHaveURL('/business', { timeout: 5000 })
  })

  test('404 page for unknown route', async ({ page }) => {
    await page.goto('/this-does-not-exist', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.getByText('Page not found')).toBeVisible({ timeout: 8000 })
  })
})
