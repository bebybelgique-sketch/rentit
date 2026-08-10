import { test, expect } from '@playwright/test'

test.describe('Cookie consent modal', () => {
  test('shows modal on first visit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await expect(page.getByText('We use cookies to improve your experience')).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Accept all cookies' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Decline optional' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Customize' })).toBeVisible()
  })

  test('dismisses modal on Accept all', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Accept all cookies' }).click({ timeout: 8000 })
    await expect(page.getByText('We use cookies to improve your experience')).not.toBeVisible()
  })

  test('does not show modal on second visit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Accept all cookies' }).click({ timeout: 8000 })
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(800)
    await expect(page.getByText('We use cookies to improve your experience')).not.toBeVisible()
  })

  test('Customize panel shows toggles', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Customize' }).click({ timeout: 8000 })
    await expect(page.getByText('Cookie preferences')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Necessary').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Functional').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Analytics').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Save preferences' })).toBeVisible({ timeout: 5000 })
  })

  test('Decline optional dismisses modal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Decline optional' }).click({ timeout: 8000 })
    await expect(page.getByText('We use cookies to improve your experience')).not.toBeVisible()
  })
})
