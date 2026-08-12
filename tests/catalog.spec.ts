import { test, expect } from '@playwright/test'
import { skipModals, dismissCookies, CATEGORY_LABEL, UI, login } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''

/**
 * Единый справочник: категории, состояния, статусы.
 *
 * Опись 12.08 нашла шесть независимых объявлений категорий, и три уже
 * разошлись на глазах у человека: ⚡ на витрине против 🔌 на странице вещи,
 * «Jardinage» против «Jardin & Extérieur», «Mesure & Détection» против
 * «Mesure». Проверки ниже стерегут именно совпадение между экранами — то,
 * чего не видно в одном файле.
 */
test.describe('единый справочник', () => {
  test.beforeEach(async ({ page }) => {
    await skipModals(page)
  })

  test('лендинг и витрина зовут категории одинаково', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForLoadState('networkidle').catch(() => {})

    // На лендинге подпись без ведущего эмодзи, на витрине — с ним.
    // Сравниваем словесную часть.
    for (const label of Object.values(CATEGORY_LABEL)) {
      const word = label.replace(/^\S+\s/, '')
      await expect(page.getByText(word, { exact: true }).first())
        .toBeVisible({ timeout: 15000 })
    }
  })

  test('плитка категории с лендинга действительно фильтрует витрину', async ({ page }) => {
    // Раньше плитки вели на /browse?category=…, а витрина этот параметр не
    // читала: человек нажимал «Électroportatif» и попадал в общий список.
    await page.goto('/', { waitUntil: 'load' })
    await page.waitForLoadState('networkidle').catch(() => {})

    const tile = page.getByRole('link', { name: /Jardinage/ }).first()
    await expect(tile).toBeVisible({ timeout: 15000 })
    await tile.click()

    await expect(page).toHaveURL(/\/browse\?category=garden/, { timeout: 15000 })

    // И чип этой категории на витрине выбран — фильтр применён, а не забыт.
    const chip = page.getByRole('button', { name: CATEGORY_LABEL.garden, exact: true })
    await expect(chip).toHaveClass(/active/, { timeout: 15000 })
  })

  test('чужая категория в адресе не роняет витрину в пустоту', async ({ page }) => {
    // ?category=logement — категории из чужого продукта. Без проверки она
    // отфильтровала бы всё в ноль и читалась как «ничего нет».
    await page.goto('/browse?category=logement', { waitUntil: 'load' })

    const anyChip = page.getByRole('button', { name: CATEGORY_LABEL.garden, exact: true })
    await expect(anyChip).toBeVisible({ timeout: 15000 })
    await expect(anyChip).not.toHaveClass(/active/)
  })

  test('витрина и страница вещи показывают один значок категории', async ({ page }) => {
    test.skip(!OWNER_EMAIL || !OWNER_PASSWORD, 'Нет учётки владельца в окружении')

    let item: CreatedItem | null = null
    try {
      await login(page, OWNER_EMAIL, OWNER_PASSWORD)
      item = await createItem(page, {
        title: uniqueTitle('E2E справочник'),
        category: 'power_tools',
      })

      // Витрина: значок в карточке без фотографии.
      await page.goto('/browse', { waitUntil: 'load' })
      await dismissCookies(page)
      const card = page.locator('.item-card').filter({ hasText: item.title })
      await expect(card).toBeVisible({ timeout: 20000 })
      const onBrowse = await card.locator('.item-card-img').innerText()

      // Страница вещи: тот же значок. Здесь и было расхождение ⚡ / 🔌.
      await page.goto(item.href, { waitUntil: 'load' })
      await expect(page.getByRole('heading', { name: item.title })).toBeVisible({ timeout: 20000 })
      const onDetail = await page.locator('.card').first().innerText()

      expect(onBrowse.trim()).toBe('⚡')
      expect(onDetail).toContain('⚡')
      void UI
    } finally {
      if (item) {
        await login(page, OWNER_EMAIL, OWNER_PASSWORD)
        await removeItem(page, item.id)
      }
    }
  })
})
