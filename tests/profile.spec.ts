import { test, expect } from '@playwright/test'
import { login, dismissCookies, UI } from './helpers/app'

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

  // Сохранение профиля — дважды за два месяца оно ломалось у ВСЕХ, и оба
  // раза молча: в августе на RETURNING *, с 24.09 по 03.10 — на политике,
  // сверявшей колонку, которую вошедшему запретили читать (миграция 58).
  // Без фото профиля выкладка закрыта, так что новый человек не мог выложить
  // вещь. Сквозные проверки не видели этого: у их учёток фото и имя давно
  // стоят, и путь сохранения не проходил ни один сценарий. Этот проходит.
  test('сохранение профиля проходит', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto('/profile', { waitUntil: 'load' })
    await dismissCookies(page)

    const name = page.locator('#full_name')
    const submit = page.getByRole('button', { name: UI.profileSubmit })
    await expect(name).toBeVisible({ timeout: 20000 })
    // Поле видно раньше, чем в него ляжет имя из базы: прочитанное сразу
    // оказывалось пустым, и тест «возвращал» пустое имя, которое форма не
    // даёт сохранить. Ждём настоящее значение.
    await expect(name).not.toHaveValue('', { timeout: 20000 })
    const before = await name.inputValue()

    // Кнопка неактивна, пока в форме ничего не изменено. Поэтому меняем
    // имя, сохраняем, потом возвращаем прежнее — два настоящих сохранения.
    const changed = before.endsWith(' E2E') ? before.slice(0, -4) : `${before} E2E`
    await name.fill(changed)
    await submit.click()
    await expect(page.getByText(UI.profileSaved)).toBeVisible({ timeout: 20000 })

    await name.fill(before)
    await submit.click()
    // Сохранённое снова совпало с формой — кнопка гаснет. Если второе
    // сохранение не прошло, в базе осталось изменённое имя, и кнопка
    // осталась бы активной.
    await expect(submit).toBeDisabled({ timeout: 20000 })
    await expect(name).toHaveValue(before)
  })
})
