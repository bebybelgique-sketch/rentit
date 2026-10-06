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

  // Поиск и чипы на широком экране заходят на коллаж слоем. На 905–960px
  // они наезжали на карточки коллажа (замер 06.10): CSS читается как
  // верный, ошибку видно только в браузере. Ширины — границы промежутка
  // и точка, где расширение включается.
  for (const width of [905, 960, 1100, 1440]) {
    test(`первый экран на ${width}px: поиск и чипы не наезжают на карточки коллажа`, async ({ page }) => {
      await skipModals(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/', { waitUntil: 'load' })
      await expect(page.locator('.lp-float-dates')).toBeVisible({ timeout: 10000 })
      // Карточки коллажа въезжают анимацией; меряем после неё.
      await page.waitForTimeout(1300)

      const box = async (sel: string) => {
        const b = await page.locator(sel).boundingBox()
        if (!b) throw new Error(`нет ${sel}`)
        return b
      }
      const hit = (a: { x: number; y: number; width: number; height: number },
                   b: { x: number; y: number; width: number; height: number }) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

      const front = [await box('.lp-search'), await box('.lp-tasks')]
      const cards = [await box('.lp-float-listing'), await box('.lp-float-dates')]
      for (const f of front) for (const c of cards) expect(hit(f, c)).toBe(false)
    })
  }
})
