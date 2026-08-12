import { test, expect } from '@playwright/test'
import { login, dismissCookies } from './helpers/app'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''

/**
 * Профиль: имя не должно подменяться почтой.
 *
 * `full_name` — публичное поле: миграция 07 разрешает читать его анониму, и
 * оно подписывает владельца на каждой странице вещи. Форма подставляла в него
 * `user.email`, если имя не задано, и было оно обязательным — значит человек,
 * открывший профиль и нажавший «сохранить», публиковал свой адрес, ничего об
 * этом не узнав. 12.08 такая строка нашлась в базе: её создал обычный путь
 * через интерфейс, а не тестовый скрипт.
 */
test.describe('профиль', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Нет учётки владельца в окружении')

  test('в поле имени не подставляется почта', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto('/profile', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForLoadState('networkidle').catch(() => {})

    const name = page.locator('#full_name')
    await expect(name).toBeVisible({ timeout: 20000 })

    // Собаки в публичном имени быть не может ни при каких обстоятельствах.
    await expect(name).not.toHaveValue(/@/)
    // И поле не пустое: значение читается из базы, а не из user_metadata,
    // иначе человек с сохранённым именем видит пустоту и «теряет» его.
    await expect(name).not.toHaveValue('')
  })

  test('имя владельца на странице вещи — не почта', async ({ page }) => {
    // Вторая сторона той же проверки: даже если в базе окажется адрес,
    // видно это станет здесь — на публичной странице.
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForLoadState('networkidle').catch(() => {})

    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
  })
})
