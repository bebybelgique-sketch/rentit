import { test, expect } from '@playwright/test'
import { UI, CATEGORY_LABEL, skipModals } from './helpers/app'

test.describe('витрина', () => {
  test.beforeEach(async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })
  })

  test('открывается и показывает поиск', async ({ page }) => {
    await expect(page).toHaveURL(/\/browse/)
    const search = page.getByPlaceholder(UI.browseSearchPlaceholder)
    await expect(search).toBeVisible({ timeout: 10000 })
    await search.fill('perceuse')
    await expect(search).toHaveValue('perceuse')
  })

  test('показывает все шесть категорий кнопками', async ({ page }) => {
    for (const label of Object.values(CATEGORY_LABEL)) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
    }
  })

  test('переключатель «сетка / карта» на месте', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Grille' })).toBeVisible({ timeout: 10000 })
    const map = page.getByRole('button', { name: 'Carte' })
    await expect(map).toBeVisible()

    // Карта должна действительно открываться, а не быть подписью.
    await map.click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })
  })

  test('выбор категории не роняет страницу', async ({ page }) => {
    const chip = page.getByRole('button', { name: CATEGORY_LABEL.garden, exact: true })
    await expect(chip).toBeVisible({ timeout: 10000 })
    await chip.click()

    // Что бы ни нашлось, страница обязана остаться живой и отвечать:
    // либо карточки, либо внятная пустота.
    await expect(
      page.locator('.item-card').first().or(page.getByRole('heading', { name: UI.browseEmptyHeading })),
    ).toBeVisible({ timeout: 15000 })
  })

  test('пустая витрина объясняет пустоту и даёт выход', async ({ page }) => {
    const cards = page.locator('.item-card')
    await expect(cards.first().or(page.getByRole('heading', { name: UI.browseEmptyHeading })))
      .toBeVisible({ timeout: 15000 })

    test.skip(await cards.count() > 0, 'На витрине есть инструменты — проверять пустое состояние нечем')

    // Пустота витрины — решение, а не поломка. Дефектом была бы пустота,
    // которая ведёт в тупик: человеку должно быть ясно, что делать дальше.
    await expect(page.getByRole('heading', { name: UI.browseEmptyHeading })).toBeVisible()
    await expect(page.getByRole('link', { name: /Déposer votre premier outil/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Élargir à 50 km/i })).toBeVisible()
  })
})
