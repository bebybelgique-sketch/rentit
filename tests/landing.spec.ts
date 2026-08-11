import { test, expect } from '@playwright/test'
import { UI, dismissCookies, skipModals } from './helpers/app'

/**
 * Лендинг и навигация в неавторизованном виде.
 *
 * Из мартовского набора убраны три проверки «селектора профиля»
 * (Who are you? → Individual / Business): компонент src/components/
 * ProfileSelector.tsx нигде не импортируется, на странице его нет и не было.
 * Проверять несуществующее нечем; судьба самого компонента — отдельный
 * разговор, он ещё и уводит на маршрут /business, которого нет в App.tsx.
 */
test.describe('лендинг', () => {
  test('заголовок первого экрана виден', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('в навбаре есть витрина и вход', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await dismissCookies(page)

    await expect(page.getByRole('link', { name: UI.navBrowse }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: UI.navLogin }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: UI.navSignup }).first()).toBeVisible()
  })

  test('гостю не показывают кабинет', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await dismissCookies(page)
    await expect(page.getByRole('button', { name: UI.navLogout })).toHaveCount(0)
  })

  test('витрина открывается по ссылке из навбара', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await dismissCookies(page)

    await page.getByRole('link', { name: UI.navBrowse }).first().click()
    await expect(page).toHaveURL(/\/browse/, { timeout: 10000 })
  })

  test('несуществующий адрес даёт 404, а не пустой экран', async ({ page }) => {
    await skipModals(page)
    await page.goto('/this-does-not-exist', { waitUntil: 'load' })
    await expect(page.getByText(UI.notFound)).toBeVisible({ timeout: 10000 })
    // Из тупика есть выход — иначе человек упирается в стену.
    await expect(page.getByRole('link', { name: /Parcourir les outils/i })).toBeVisible()
  })
})
