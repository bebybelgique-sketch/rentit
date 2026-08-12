import { test, expect } from '@playwright/test'
import { UI, skipModals, CATEGORY_LABEL } from './helpers/app'

/**
 * Свёрнутые фильтры.
 *
 * Второстепенные фильтры занимали весь первый экран телефона: семь полей
 * подряд и ни одного инструмента. Витрина обязана показывать инструменты.
 *
 * Опасность у такого сворачивания одна и она серьёзная: спрятанный, но
 * ДЕЙСТВУЮЩИЙ фильтр. Человек видит две вещи вместо двадцати и решает, что
 * на площадке пусто. Поэтому проверяется не только «панель открывается», а
 * что применённый фильтр о себе объявляет.
 */
test.describe('фильтры витрины', () => {
  test.beforeEach(async ({ page }) => {
    await skipModals(page)
  })

  test('второстепенные фильтры свёрнуты, поиск и близость — нет', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })

    await expect(page.getByPlaceholder(UI.browseSearchPlaceholder)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: UI.nearby })).toBeVisible()
    await expect(page.getByRole('button', { name: /Filtres/ })).toBeVisible()

    // Свёрнуто — значит полей не видно.
    await expect(page.getByText('Prix max / jour')).toHaveCount(0)
    await expect(page.getByText('Disponible du')).toHaveCount(0)
  })

  test('панель раскрывается и показывает подписанный диапазон дат', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    const toggle = page.getByRole('button', { name: /Filtres/ })
    await expect(toggle).toBeVisible({ timeout: 15000 })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Два одинаковых dd.mm.yyyy без подписей не читались как «с» и «по».
    await expect(page.getByText('Disponible du')).toBeVisible()
    await expect(page.getByText('au', { exact: true })).toBeVisible()
    await expect(page.getByText('Prix max / jour')).toBeVisible()
    await expect(page.getByText('Où', { exact: true })).toBeVisible()
  })

  test('применённый фильтр объявляет о себе на свёрнутой кнопке', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    const toggle = page.getByRole('button', { name: /Filtres/ })
    await expect(toggle).toBeVisible({ timeout: 15000 })
    await toggle.click()

    await page.getByText('Prix max / jour').locator('..').locator('input').fill('25')
    await expect(page.getByRole('button', { name: /Filtres · 1/ })).toBeVisible({ timeout: 10000 })

    // Сворачиваем — счётчик обязан остаться: иначе фильтр действует молча.
    await page.getByRole('button', { name: /Filtres · 1/ }).click()
    await expect(page.getByText('Prix max / jour')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Filtres · 1/ })).toBeVisible()
  })

  test('приход с лендинга с ?where= сразу открывает панель', async ({ page }) => {
    // Лендинг кладёт место в адрес. Если панель останется свёрнутой, выдача
    // уже сужена, а причина не видна.
    await page.goto('/browse?where=Wavre', { waitUntil: 'load' })

    await expect(page.getByText('Où', { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Filtres · 1/ })).toBeVisible()
  })

  test('категорию выбирают одним органом — чипами', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })

    // Чипы на месте.
    for (const label of Object.values(CATEGORY_LABEL)) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 15000 })
    }

    // А дублирующего селекта «Tous les outils» больше нет: два органа для
    // одного фильтра — это вопрос «а они об одном и том же?» на каждом визите.
    await expect(page.getByRole('combobox', { name: /catégorie|category/i })).toHaveCount(0)
  })
})
