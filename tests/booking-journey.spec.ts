import { test, expect, type Page } from '@playwright/test'
import { login, dismissCookies, withDialog } from './helpers/app'
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
 * Нажимает кнопку владельца и ДОЖИДАЕТСЯ ответа edge-функции.
 *
 * Одобрение и переходы статуса идут не прямым UPDATE, а вызовом функции
 * (respond-to-request / transition-booking), и занимают около двух секунд.
 * Уход на другую сессию сразу после клика обрывал запрос на полпути: бронь
 * оставалась в прежнем статусе, а тест винил следующий экран. Тот же
 * промах уже случился с сохранением профиля — здесь он повторён на кнопках.
 */
async function clickAndAwaitFunction(page: Page, name: RegExp, fn: RegExp) {
  const button = page.getByRole('button', { name }).first()
  await expect(button).toBeVisible({ timeout: 15000 })

  const response = page.waitForResponse(
    r => fn.test(r.url()) && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await button.click()
  const result = await response
  expect(result.ok(), `функция ответила ${result.status()}: ${await result.text().catch(() => '')}`)
    .toBeTruthy()
}

const RESPOND = /\/functions\/v1\/respond-to-request/
const TRANSITION = /\/functions\/v1\/transition-booking/

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
    await clickAndAwaitFunction(page, APPROVE_BUTTON, RESPOND)

    // Арендатор видит подтверждение и может ещё отменить.
    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await openMyRentals(page)
    await expect(page.getByText(/Confirmé/i).first()).toBeVisible({ timeout: 15000 })

    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await openOwnerDashboard(page)
    await clickAndAwaitFunction(page, MARK_PICKED_UP_BUTTON, TRANSITION)

    await openOwnerDashboard(page)
    await clickAndAwaitFunction(page, MARK_RETURNED_BUTTON, TRANSITION)

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
    await clickAndAwaitFunction(page, APPROVE_BUTTON, RESPOND)

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    await openMyRentals(page)

    const cancel = page.getByRole('button', { name: CANCEL_BUTTON }).first()
    await expect(cancel).toBeVisible({ timeout: 15000 })

    // Причину спрашивают через prompt(). Обработчик живёт ровно на время
    // клика: постоянный слушатель уже однажды перехватил чужой диалог и
    // ответил пустотой — причина уходила null, и это выглядело потерей
    // данных в продукте.
    await withDialog(page, reason, async () => {
      await cancel.click()
    })
    await expect(page.getByText(/annulé/i).first()).toBeVisible({ timeout: 15000 })

    // Смысл проверки: причина доходит до второй стороны, а не теряется.
    // .first() — потому что владелец видит её в двух местах (в списке своих
    // аренд и в блоке заявок на свою вещь); без него strict mode валит тест
    // на том, что причина показана дважды.
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await openMyRentals(page)
    await expect(page.getByText(reason).first()).toBeVisible({ timeout: 15000 })
  })
})
