import { test, expect } from '@playwright/test'

async function dismissCookies(page: any) {
  await page.waitForTimeout(800)
  try {
    const btn = page.getByRole('button', { name: 'Accept all cookies' })
    if (await btn.isVisible({ timeout: 3000 })) await btn.click()
  } catch { /* already dismissed */ }
}

test.describe('Auth flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.getByText('Log in to RentIt')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.locator('input[type="email"]').fill('wrong@email.com')
    await page.locator('input[type="password"]').fill('wrongpassword123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.locator('.error-msg')).toBeVisible({ timeout: 10000 })
  })

  test('register page loads', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 })
  })

  test('protected /list-item redirects to login', async ({ page }) => {
    await page.goto('/list-item', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('protected /my-items redirects to login', async ({ page }) => {
    await page.goto('/my-items', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 })
  })
})
