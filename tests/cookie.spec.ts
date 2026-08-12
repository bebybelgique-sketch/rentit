import { test, expect } from '@playwright/test'
import { UI } from './helpers/app'

/**
 * Баннер cookies. Тексты здесь английские — так в продукте на 11.08, при
 * французском навбаре на том же экране. Тест сверяется с тем, что есть,
 * а несоответствие языков вынесено в отчёт как находка: чинить его надо в
 * продукте, и молчаливая «подгонка» теста под расхождение это бы скрыла.
 */
test.describe('согласие на cookies', () => {
  test('на первом визите баннер показан и предлагает три исхода', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })

    await expect(page.getByRole('heading', { name: UI.cookieHeading })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: UI.cookieAcceptAll })).toBeVisible()
    await expect(page.getByRole('button', { name: UI.cookieDeclineOptional })).toBeVisible()
    await expect(page.getByRole('button', { name: UI.cookieManage })).toBeVisible()
  })

  test('«принять всё» закрывает баннер и он не возвращается', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })

    const heading = page.getByRole('heading', { name: UI.cookieHeading })
    await expect(heading).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: UI.cookieAcceptAll }).click()
    await expect(heading).toBeHidden()

    // Согласие переживает перезагрузку — иначе спрашивали бы на каждой странице.
    await page.reload({ waitUntil: 'load' })
    await expect(heading).toBeHidden({ timeout: 10000 })
  })

  test('«отклонить необязательные» тоже закрывает баннер', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })

    const heading = page.getByRole('heading', { name: UI.cookieHeading })
    await expect(heading).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: UI.cookieDeclineOptional }).click()
    await expect(heading).toBeHidden()
  })

  test('панель настройки показывает три категории и сохранение', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })

    await expect(page.getByRole('button', { name: UI.cookieManage })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: UI.cookieManage }).click()

    await expect(page.getByText('Cookie preferences')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Necessary').first()).toBeVisible()
    await expect(page.getByText('Functional').first()).toBeVisible()
    await expect(page.getByText('Analytics').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save preferences' })).toBeVisible()
  })
})
