import { test, expect } from '@playwright/test'
import { skipModals } from './helpers/app'

/**
 * Страница для прокатных контор.
 *
 * До 11.08 подвал вёл на /business с тарифами Starter €49 / Growth €99.
 * Коммит 1409b3a снял платную модель и понизил ссылку до <span>: надпись
 * осталась, вести стало некуда. Полгода единственное обращение к
 * профессионалам было мёртвым текстом.
 */
test.describe('страница для прокатных контор', () => {
  test.beforeEach(async ({ page }) => {
    await skipModals(page)
  })

  test('подвал ведёт на страницу, а не просто написан', async ({ page }) => {
    await page.goto('/browse', { waitUntil: 'load' })

    const link = page.getByRole('link', { name: /magasins de location|loueurs professionnels/i })
    await expect(link).toBeVisible({ timeout: 15000 })

    await link.click()
    await expect(page).toHaveURL(/\/rental-shops/, { timeout: 15000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('называет границы вслух, а не мелким шрифтом', async ({ page }) => {
    await page.goto('/rental-shops', { waitUntil: 'load' })

    await expect(page.getByRole('heading', { name: /ne fait pas/i })).toBeVisible({ timeout: 15000 })

    // Четыре отказа, каждый из которых человеку дороже узнать до, чем после.
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/Aucun paiement ne transite/i)
    expect(body).toMatch(/Aucune assurance/i)
    expect(body).toMatch(/Aucune commission/i)
    expect(body).toMatch(/Aucun trafic promis/i)
  })

  test('тарифов на странице нет', async ({ page }) => {
    await page.goto('/rental-shops', { waitUntil: 'load' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 })

    // Суть: платной модели нет, значит и сумм на этой странице быть не может.
    // Прежняя /business обещала Starter €49 / Growth €99 — обещание, которое
    // продукт сегодня не выполняет.
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/€\s?\d/)
    expect(body).not.toMatch(/\d+\s?€/)
    expect(body).not.toMatch(/\/mois|par mois|per month|per maand/i)
  })

  test('не выдумывает, сколько контор уже с нами', async ({ page }) => {
    await page.goto('/rental-shops', { waitUntil: 'load' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 })

    // Контор ноль. Любое число рядом со словом о партнёрах — выдумка,
    // а выдуманное число обесценивает всё остальное на странице.
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/\d+\s*(loueurs|magasins|partenaires|professionnels)\s/i)
    expect(body).toMatch(/vitrine est neuve et vide/i)
  })
})
