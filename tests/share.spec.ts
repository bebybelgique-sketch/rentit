import { test, expect } from '@playwright/test'
import { login, dismissCookies } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''

/**
 * Кнопка «поделиться» не должна врать об исходе.
 *
 * До 20.08 здесь стояло `writeText(url).catch(() => {})` и следом
 * безусловное `setShared(true)`: надпись «Lien copié» показывалась ВСЕГДА —
 * и когда доступ к буферу закрыт настройкой браузера, и когда страница
 * открыта не по HTTPS. Человек уходил делиться пустотой.
 */
test.describe('поделиться ссылкой', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Нет учётки владельца в окружении')

  let item: CreatedItem | null = null

  test.afterEach(async ({ page }) => {
    if (!item) return
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await removeItem(page, item.id)
    item = null
  })

  test('удачная копия говорит «скопировано»', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E ссылка') })

    await page.goto(item.href, { waitUntil: 'load' })
    await dismissCookies(page)
    await page.getByRole('button', { name: /Copier le lien/i }).click()
    // Подпись успеха — «✓ Copié !». Ждать «Lien copié» бесполезно: такой
    // строки в словаре нет вовсе, и проверка падала бы на исправном коде.
    await expect(page.getByRole('button', { name: /Copié/ })).toBeVisible({ timeout: 10000 })

    // И в буфере действительно адрес этой вещи, а не пустота.
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain(item!.id)
  })

  test('неудачная копия признаётся, а не показывает «скопировано»', async ({ page, context }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E ссылка-отказ') })

    await page.goto(item.href, { waitUntil: 'load' })
    await dismissCookies(page)

    // Ломаем буфер так, как его ломает браузер с закрытым доступом.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      })
    })
    await context.clearPermissions()

    await page.getByRole('button', { name: /Copier le lien/i }).click()
    await expect(page.getByRole('button', { name: /Copie impossible/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Copié/ })).toHaveCount(0)
  })
})
