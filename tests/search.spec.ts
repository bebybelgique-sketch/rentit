import { test, expect } from '@playwright/test'

// Pre-set localStorage so cookie banner and profile selector never show
async function skipModals(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('rentit_cookie_consent', JSON.stringify({ necessary: true, functional: true, analytics: true }))
    localStorage.setItem('rentit_profile_selected', 'individual')
  })
}

test.describe('Search', () => {
  test('landing search navigates to /browse with query', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const input = page.locator('.L-search-field input').first()
    await input.fill('Bosch')
    await page.locator('.L-search-btn').click()
    await expect(page).toHaveURL(/\/browse\?q=Bosch/, { timeout: 5000 })
  })

  test('landing search Enter key navigates to /browse', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(500)
    const input = page.locator('.L-search-field input').first()
    await input.fill('drill')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/browse/, { timeout: 5000 })
  })

  test('browse search input filters items', async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })
    await page.waitForTimeout(2000)
    const input = page.getByPlaceholder(/search/i)
    await input.fill('Bosch')
    await page.waitForTimeout(1500)
    const cards = page.locator('.item-card')
    const count = await cards.count()
    if (count > 0) {
      const first = await cards.first().locator('.item-card-title').textContent()
      expect(first?.toLowerCase()).toContain('bosch')
    }
  })

  test('/browse?q=Karcher pre-fills search and filters', async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse?q=Karcher', { waitUntil: 'load' })
    await page.waitForTimeout(2000)
    const input = page.getByPlaceholder(/search/i)
    await expect(input).toHaveValue('Karcher', { timeout: 5000 })
    const cards = page.locator('.item-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  })
})
