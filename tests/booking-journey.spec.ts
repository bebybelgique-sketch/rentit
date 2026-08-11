import { test, expect, type Page } from '@playwright/test'
import { login, dismissCookies } from './helpers/app'
import { createItem, removeItem, uniqueTitle, type CreatedItem } from './helpers/fixtures'

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''
const RENTER_EMAIL = process.env.TEST_RENTER_EMAIL ?? ''
const RENTER_PASSWORD = process.env.TEST_RENTER_PASSWORD ?? ''

const SEND_REQUEST_BUTTON = /Envoyer une demande de réservation/i
const REQUEST_SENT_MESSAGE = /demande envoyée/i
const APPROVE_BUTTON = /Accepter|Approuver/i
const MARK_PICKED_UP_BUTTON = /Marquer récupéré/i
const MARK_RETURNED_BUTTON = /Marquer retourné/i
const CANCEL_BUTTON = /Annuler/i

/**
 * Цикл аренды между двумя незнакомыми людьми — то, что обещано шести
 * прокатчикам письмами от 08.08. Единственная проверка в наборе, чей провал
 * означает, что продукт не делает заявленного.
 *
 * До 11.08 она стояла на «взять первую вещь владельца» и падала: витрина
 * очищена намеренно, вещей у владельца ноль. Теперь сценарий заводит свою
 * вещь и удаляет её в конце — прогон не зависит от состояния базы и не
 * оставляет следов.
 */
async function selectBookingRange(page: Page) {
  const nextMonth = page.locator('button').filter({ hasText: '›' }).first()
  if (await nextMonth.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextMonth.click()
  }

  const availableDays = page.locator('.cal-day.available').filter({ hasText: /\d+/ })
  await expect(availableDays.first()).toBeVisible({ timeout: 15000 })
  expect(await availableDays.count()).toBeGreaterThanOrEqual(2)

  await availableDays.nth(0).click()
  await availableDays.nth(1).click()
}

async function requestBooking(page: Page, item: CreatedItem, message: string) {
  await page.goto(item.href, { waitUntil: 'load' })
  await dismissCookies(page)

  await selectBookingRange(page)
  await page.locator('textarea').fill(message)

  const send = page.getByRole('button', { name: SEND_REQUEST_BUTTON })
  await expect(send).toBeVisible({ timeout: 10000 })
  await send.click()
  await expect(page.getByText(REQUEST_SENT_MESSAGE)).toBeVisible({ timeout: 20000 })
}

/** Кабинет владельца во вкладке «Все»: там видны и брони вне активных. */
async function openOwnerDashboard(page: Page) {
  await page.goto('/my-items', { waitUntil: 'load' })
  await dismissCookies(page)
  await page.getByRole('button', { name: /^Tous$/ }).click().catch(() => {})
}

/**
 * «Мои аренды» открываются в два приёма: сначала каркас, потом обе выборки
 * (свои брони и брони на свои вещи). Пока идёт вторая, на месте списка стоит
 * «Chargement...». Проверять содержимое до её исчезновения — значит ловить
 * пустоту и объявлять её отсутствием брони.
 */
async function openMyRentals(page: Page) {
  await page.goto('/my-rentals', { waitUntil: 'load' })
  await dismissCookies(page)
  // Выборок две, и флаги загрузки гаснут по очереди: проверка «нет
  // Chargement...» попадала в промежуток между ними и проходила рано.
  // Ждём тишины в сети, а потом уже требуем отсутствия загрузки.
  await expect(async () => {
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    await expect(page.getByText('Chargement...')).toHaveCount(0)
  }).toPass({ timeout: 45000 })
}

test.describe('цикл аренды', () => {
  test.skip(
    !OWNER_EMAIL || !OWNER_PASSWORD || !RENTER_EMAIL || !RENTER_PASSWORD,
    'Нет учёток в окружении: заполните TEST_OWNER_* и TEST_RENTER_* в .env',
  )

  let item: CreatedItem | null = null

  test.afterEach(async ({ page }) => {
    if (!item) return
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await removeItem(page, item.id)
    item = null
  })

  test('запрос → одобрение → выдача → возврат', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E цикл') })

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await requestBooking(page, item, 'Bonjour, je souhaite réserver cet outil.')

    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await openOwnerDashboard(page)
    const approve = page.getByRole('button', { name: APPROVE_BUTTON }).first()
    await expect(approve).toBeVisible({ timeout: 15000 })
    await approve.click()

    // Арендатор видит подтверждение и может ещё отменить.
    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await openMyRentals(page)
    await expect(page.getByText(/Confirmé/i).first()).toBeVisible({ timeout: 15000 })

    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await openOwnerDashboard(page)
    const pickedUp = page.getByRole('button', { name: MARK_PICKED_UP_BUTTON }).first()
    await expect(pickedUp).toBeVisible({ timeout: 15000 })
    await pickedUp.click()

    await openOwnerDashboard(page)
    const returned = page.getByRole('button', { name: MARK_RETURNED_BUTTON }).first()
    await expect(returned).toBeVisible({ timeout: 15000 })
    await returned.click()

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await openMyRentals(page)
    await expect(page.getByText(/Terminé|completed/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('арендатор отменяет подтверждённую бронь, владелец видит причину', async ({ page }) => {
    const reason = 'Besoin de modifier mes plans'

    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    item = await createItem(page, { title: uniqueTitle('E2E отмена') })

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await requestBooking(page, item, 'Test annulation.')

    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await openOwnerDashboard(page)
    await page.getByRole('button', { name: APPROVE_BUTTON }).first().click()

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await openMyRentals(page)

    // Причину спрашивают через prompt() — обработчик ставим до клика.
    page.on('dialog', dialog => {
      expect(dialog.type()).toBe('prompt')
      dialog.accept(reason).catch(() => {})
    })

    const cancel = page.getByRole('button', { name: CANCEL_BUTTON }).first()
    await expect(cancel).toBeVisible({ timeout: 15000 })
    await cancel.click()
    await expect(page.getByText(/annulé/i).first()).toBeVisible({ timeout: 15000 })

    // Смысл проверки: причина доходит до второй стороны, а не теряется.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await openMyRentals(page)
    await expect(page.getByText(reason)).toBeVisible({ timeout: 15000 })
  })
})
