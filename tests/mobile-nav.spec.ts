import { test, expect, devices } from '@playwright/test'

// Дымовая проверка мобильной навигации на живом адресе.
// Претензия из разбора («landing-nav на мобильных не адаптирован») читалась
// по коду как устаревшая: бургер есть, ссылки скрыты по умолчанию. Но чтение
// CSS — не доказательство поведения, поэтому проверяем в браузере.
test.use({ ...devices['Pixel 5'] })

test.describe('мобильная навигация', () => {
  test('на лендинге бургер виден, меню скрыто и открывается', async ({ page }) => {
    await page.goto('/')

    const burger = page.locator('.navbar-burger')
    await expect(burger).toBeVisible()

    // До нажатия ссылки не должны занимать экран.
    const browse = page.locator('.navbar-links a[href="/browse"]')
    await expect(browse).toBeHidden()

    await burger.click()
    await expect(browse).toBeVisible()

    // Переход из меню действительно уводит на витрину.
    await browse.click()
    await expect(page).toHaveURL(/\/browse/)
  })

  test('витрина открывается и не разъезжается по горизонтали', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForLoadState('domcontentloaded')

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
