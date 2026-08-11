import { test, expect } from '@playwright/test'
import { UI, skipModals } from './helpers/app'

/**
 * Поиск с лендинга и разбор ?q= на витрине.
 *
 * Проверка «найденное действительно отфильтровано» требует инструмента в базе
 * и живёт в showcase.spec.ts вместе с оснасткой. Здесь — только то, что
 * проверяемо на пустой витрине: запрос доезжает до адреса и до поля.
 */
test.describe('поиск', () => {
  test('поиск с лендинга уводит на витрину с запросом', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })

    const input = page.locator('.L-search-field input').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('Bosch')
    await page.locator('.L-search-btn').click()

    await expect(page).toHaveURL(/\/browse\?q=Bosch/, { timeout: 10000 })
  })

  test('Enter в поле лендинга работает как кнопка', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })

    const input = page.locator('.L-search-field input').first()
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('perceuse')
    await input.press('Enter')

    await expect(page).toHaveURL(/\/browse\?q=perceuse/, { timeout: 10000 })
  })

  test('?q= из адреса подставляется в поле витрины', async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse?q=Karcher', { waitUntil: 'load' })

    // Запрос обязан доехать до поля: иначе человек видит отфильтрованную
    // выдачу и пустую строку поиска, и не понимает, почему мало результатов.
    await expect(page.getByPlaceholder(UI.browseSearchPlaceholder)).toHaveValue('Karcher', { timeout: 15000 })
  })
})
