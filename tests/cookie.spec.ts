import { test, expect } from '@playwright/test'
import { UI } from './helpers/app'

/**
 * Баннер cookies. До 12.08 тексты здесь были английскими — так было в
 * продукте при французском навбаре на том же экране. Тест сверялся с тем,
 * что есть, а несоответствие вынес в отчёт как находку: чинить его надо
 * было в продукте, и молчаливая «подгонка» теста это бы скрыла.
 *
 * 12.08 баннер переведён на три языка, и тест переведён следом. Подписи
 * лежат в UI (tests/helpers/app.ts) одним местом — при следующей правке
 * текстов менять там.
 *
 * Важно про адрес: baseURL в playwright.config по умолчанию указывает на
 * прод, а не на локальную сборку. Пока эта ветка не смержена и не
 * задеплоена, прогон без E2E_BASE_URL будет падать здесь — он проверяет
 * старую задеплоенную версию, а не рабочее дерево.
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

    await expect(page.getByText(UI.cookiePrefsTitle)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(UI.cookieTypeNecessary).first()).toBeVisible()
    await expect(page.getByText(UI.cookieTypeFunctional).first()).toBeVisible()
    await expect(page.getByText(UI.cookieTypeAnalytics).first()).toBeVisible()
    await expect(page.getByRole('button', { name: UI.cookieSavePrefs })).toBeVisible()
  })
})
