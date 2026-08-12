import { test, expect } from '@playwright/test'
import { skipModals } from './helpers/app'

/**
 * Один словарь на весь продукт.
 *
 * До 12.08 систем было две: react-i18next держал навбар, самописная —
 * витрину и страницы. Кнопка EN переключала навбар, а тело страницы
 * оставалось французским. До нидерландского было не добраться вовсе,
 * хотя словарь nl лежал полный.
 *
 * Проверки ниже стерегут именно это: переключение доходит до СОДЕРЖИМОГО,
 * а не только до шапки.
 */
test.describe('язык', () => {
  test.beforeEach(async ({ page }) => {
    await skipModals(page)
  })

  test('переключение меняет и навбар, и тело страницы', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })

    // По умолчанию французский: и шапка, и заголовок витрины.
    await expect(page.getByRole('link', { name: 'Parcourir' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText('outils de votre voisin')

    // Один шаг переключателя — английский.
    await page.getByRole('button', { name: 'EN' }).click()

    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible({ timeout: 15000 })
    // Суть: заголовок ТЕЛА страницы тоже сменился. Раньше он оставался
    // французским рядом с английской шапкой.
    await expect(page.getByRole('heading', { level: 1 })).toContainText("neighbor's tools")
  })

  test('до нидерландского можно добраться', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })
    await expect(page.getByRole('button', { name: 'EN' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'EN' }).click()
    await page.getByRole('button', { name: 'NL' }).click()

    await expect(page.getByRole('link', { name: 'Bladeren' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Gereedschap van je buurman')

    // И круг замыкается обратно на французский.
    await page.getByRole('button', { name: 'FR' }).click()
    await expect(page.getByRole('link', { name: 'Parcourir' })).toBeVisible({ timeout: 15000 })
  })

  test('выбор языка переживает перезагрузку', async ({ page }) => {
    // react-i18next был настроен на жёсткое lng: 'fr'. При сведении систем
    // сохранение выбора могло молча потеряться, и человек возвращался бы во
    // французский на каждой странице.
    await page.goto('/browse', { waitUntil: 'load' })
    await page.getByRole('button', { name: 'EN' }).click()
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible({ timeout: 15000 })

    await page.reload({ waitUntil: 'load' })
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible({ timeout: 15000 })
  })

  test('навбар и страница зовут одно одинаково', async ({ page }) => {
    // Навбар говорил «Mes articles», заголовок той же страницы —
    // «Mes outils»: два словаря, два слова для одной сущности.
    await page.goto('/browse', { waitUntil: 'load' })
    await expect(page.getByRole('link', { name: 'Parcourir' })).toBeVisible({ timeout: 15000 })

    const body = await page.locator('body').innerText()
    expect(body).not.toContain('Mes articles')
    expect(body).not.toContain('Déposer un article')
  })
})
