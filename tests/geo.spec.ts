import { test, expect } from '@playwright/test'
import { login, dismissCookies, skipModals, UI } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''

// Вавр, Брабант-Валлон — регион продукта. Позиция подменяется браузеру,
// поэтому проверка не зависит от того, где физически стоит машина.
const WAVRE = { latitude: 50.7167, longitude: 4.6167 }

test.use({ geolocation: WAVRE, permissions: ['geolocation'] })

/**
 * Поиск «À proximité» и расстояние.
 *
 * Суть в том, что вещь БЕЗ координат исчезает из поиска по близости целиком,
 * а владелец об этом не узнаёт: в форме координаты необязательны и ставятся
 * только кнопкой «Utiliser ma position». Напечатал адрес руками — объявления в главном
 * способе поиска нет, и никакого объяснения.
 */
test.describe('поиск по близости', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Нет учётки владельца в окружении')

  let item: CreatedItem | null = null

  test.afterEach(async ({ page }) => {
    if (!item) return
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await removeItem(page, item.id)
    item = null
  })

  test('вещь без координат не видна по близости, но видна в общем списке', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E безкоординат') })

    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })

    // В общем списке вещь есть.
    const card = page.locator('.item-card').filter({ hasText: item.title })
    await expect(card).toBeVisible({ timeout: 20000 })

    // Включаем «À proximité» — и она пропадает.
    await page.getByRole('button', { name: UI.nearby }).click()
    await expect(card).toHaveCount(0, { timeout: 20000 })

    // Выключаем — возвращается. Значит дело в координатах, а не в том,
    // что вещь вообще исчезла из базы.
    await page.getByRole('button', { name: UI.nearby }).click()
    await expect(card).toBeVisible({ timeout: 20000 })
  })

  test('вещь с координатами видна по близости и показывает расстояние', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E скоордин'), withPosition: true })

    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })

    const card = page.locator('.item-card').filter({ hasText: item.title })
    await expect(card).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: UI.nearby }).click()
    await expect(card).toBeVisible({ timeout: 20000 })

    // Расстояние считалось и раньше — ради фильтра, — но на экран не попадало.
    await expect(card).toContainText(/à \d+([.,]\d+)? (m|km)/, { timeout: 20000 })
  })

  test('вещь вне радиуса отсекает база — до браузера она не доезжает', async ({ page, context }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E далеко'), withPosition: true })

    // Человек «уехал» в Париж — до вещи в Вавре около 250 км.
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })

    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })
    const card = page.locator('.item-card').filter({ hasText: item.title })
    await expect(card).toBeVisible({ timeout: 20000 })

    // Ловим ИМЕННО тот ответ, которым витрина отвечает на включённую близость.
    const payload = page.waitForResponse(
      r => r.url().includes('/rest/v1/rpc/browse_items') && r.request().method() === 'POST',
      { timeout: 30000 },
    )
    await page.getByRole('button', { name: UI.nearby }).click()
    const body = await (await payload).text()

    // Суть проверки: раньше браузер получал все вещи и отсеивал их сам.
    // Теперь вещи вне радиуса нет уже в ответе сервера.
    expect(body).not.toContain(item.title)
    await expect(card).toHaveCount(0, { timeout: 20000 })
  })

  test('форма предупреждает, что без позиции вещь не найдут по близости', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto('/list-item', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForLoadState('networkidle')

    const warning = page.getByText(/n'apparaîtra pas dans la recherche/i)
    await expect(warning).toBeVisible({ timeout: 20000 })

    // Поставил позицию — предупреждение уходит, потому что перестало быть правдой.
    await page.getByRole('button', { name: /Utiliser ma position/i }).click()
    await expect(page.getByRole('button', { name: /Position enregistrée/i })).toBeVisible({ timeout: 20000 })
    await expect(warning).toHaveCount(0)
  })
})

/**
 * Отказ в геолокации.
 *
 * До 20.08 обработчик отказа в Home.tsx был `() => setGeoLoading(false)`:
 * кнопка мигала «...» и возвращалась как была. Отказ при этом обычный —
 * разрешение не дано, прежний отказ запомнен браузером, службы
 * местоположения выключены в системе, — и снаружи это неотличимо от
 * «кнопка не работает».
 *
 * Поймать это прежний набор не мог по устройству: весь файл идёт под
 * `permissions: ['geolocation']` с подставленными координатами, то есть
 * проверяет ТОЛЬКО успешный путь. Разрешение здесь снимается намеренно.
 */
test.describe('без разрешения на геолокацию', () => {
  test.use({ permissions: [] })

  test('кнопка «À proximité» объясняет отказ, а не молчит', async ({ page, context }) => {
    // Снимаем и то, что могло остаться от контекста: браузер обязан
    // ответить отказом, иначе проверка ничего не проверяет.
    await context.clearPermissions()

    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })
    await dismissCookies(page)

    await page.getByRole('button', { name: UI.nearby }).click()

    await expect(page.getByText(/Localisation indisponible/i)).toBeVisible({ timeout: 20000 })
    // И кнопка снова доступна: залипшая в «...» и отключённая навсегда —
    // второй способ выглядеть сломанной.
    await expect(page.getByRole('button', { name: UI.nearby })).toBeEnabled({ timeout: 15000 })
  })
})
