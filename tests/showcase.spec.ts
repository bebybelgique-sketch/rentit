import { test, expect } from '@playwright/test'
import { login, skipModals, UI } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''

/**
 * Заменяет мартовский items.spec.ts.
 *
 * Тот проверял витрину по 26 сгенерированным объявлениям и после их удаления
 * стал непроходимым: шесть проверок стояли на `.item-card`, которых на пустой
 * витрине нет. Тест, требующий чужого сида, ничего не охраняет — он сообщает
 * только то, что сида нет.
 *
 * Шесть проверок сведены к одной сквозной: выложенный инструмент виден на
 * витрине, находится поиском, открывается. Это и есть то, ради чего витрина
 * существует; остальное было пересчётом карточек.
 */
test.describe('витрина с инструментом', () => {
  test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Нет учётки владельца в окружении')

  let item: CreatedItem | null = null

  test.afterEach(async ({ page }) => {
    if (!item) return
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await removeItem(page, item.id)
    item = null
  })

  test('выложенный инструмент виден, ищется и открывается', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E витрина'), pricePerDay: '14.00' })

    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })

    const card = page.locator('.item-card').filter({ hasText: item.title })
    await expect(card).toBeVisible({ timeout: 20000 })

    // Карточка обязана нести и название, и цену: без цены человек не может
    // решить, стоит ли писать владельцу.
    await expect(card.locator('.item-card-title')).toHaveText(item.title)
    await expect(card.locator('.item-card-price')).toContainText('14')

    // Поиск действительно сужает выдачу, а не только меняет адрес.
    const search = page.getByPlaceholder(UI.browseSearchPlaceholder)
    await search.fill(item.title)
    await expect(page.locator('.item-card')).toHaveCount(1, { timeout: 15000 })

    // Заведомо чужой запрос не должен оставлять нашу вещь на экране.
    await search.fill('заведомо-ничего-не-найдётся')
    await expect(page.locator('.item-card')).toHaveCount(0, { timeout: 15000 })

    await search.fill(item.title)
    await expect(page.locator('.item-card')).toHaveCount(1, { timeout: 15000 })
    await page.locator('.item-card').first().click()

    await expect(page).toHaveURL(new RegExp(`/item/${item.id}`), { timeout: 15000 })
    await expect(page.getByRole('heading', { name: item.title })).toBeVisible({ timeout: 15000 })
  })
})
