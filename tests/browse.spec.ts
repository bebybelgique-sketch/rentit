import { test, expect } from '@playwright/test'

async function dismissCookies(page: any) {
  await page.waitForTimeout(800)
  try {
    const btn = page.getByRole('button', { name: 'Accept all cookies' })
    if (await btn.isVisible({ timeout: 3000 })) await btn.click()
  } catch { /* already dismissed */ }
}

test.describe('Browse page', () => {
  test('loads browse page', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page).toHaveURL('/browse')
  })

  test('shows category filter buttons', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.getByRole('button', { name: /Power Tools/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Hand Tools/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Garden/i })).toBeVisible()
  })

  test('search input works', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible({ timeout: 8000 })
    await searchInput.fill('drill')
    await expect(searchInput).toHaveValue('drill')
  })

  test('shows empty state or items', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(2000)
    const itemCount = await page.locator('.item-card').count()
    if (itemCount === 0) {
      await expect(page.getByText(/no results|no tools/i).first()).toBeVisible()
    } else {
      expect(itemCount).toBeGreaterThan(0)
    }
  })
})
