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

    // Внутри окна, а не по всей странице: с 06.10 те же слова носит кнопка
    // подвала, которая это окно открывает (#174). Проверка — о заголовке
    // панели, и подвал к ней отношения не имеет.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(UI.cookiePrefsTitle)).toBeVisible({ timeout: 10000 })
    await expect(dialog.getByText(UI.cookieTypeNecessary).first()).toBeVisible()
    await expect(dialog.getByText(UI.cookieTypeFunctional).first()).toBeVisible()
    await expect(dialog.getByText(UI.cookieTypeAnalytics).first()).toBeVisible()
    await expect(dialog.getByRole('button', { name: UI.cookieSavePrefs })).toBeVisible()
  })

  // Отозвать согласие так же просто, как дать (GDPR, ст. 7(3)): с 06.10
  // переключатель «Analytique» решает, уходят ли дневные счётчики.
  test('выбор меняется из подвала: согласие на статистику отзывается', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' })
    await page.getByRole('button', { name: UI.cookieAcceptAll }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: UI.cookiePrefsTitle }).click()
    const dialog = page.getByRole('dialog')
    const analytics = dialog.getByRole('button', { name: UI.cookieTypeAnalytics })
    await expect(analytics).toHaveAttribute('aria-pressed', 'true')
    await analytics.click()
    await dialog.getByRole('button', { name: UI.cookieSavePrefs }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    const saved = await page.evaluate(() => localStorage.getItem('rentit_cookie_consent'))
    expect(JSON.parse(saved ?? '{}')).toMatchObject({ analytics: false })
  })
})
