import { expect, type Page } from '@playwright/test'
import { UI, dismissCookies, withDialog } from './app'

/**
 * Витрина пуста НАМЕРЕННО: 26 сгенерированных объявлений удалены, и это
 * решение остаётся в силе. Поэтому тест, которому нужна вещь, обязан завести
 * её сам и убрать за собой.
 *
 * Так падал booking-journey 11.08: он начинался со «взять первую вещь
 * владельца», а у владельца их ноль. Проверка, зависящая от чужого сида, на
 * пустой витрине не проверяет ничего — она только сообщает, что сида нет.
 */

/** Уникальный заголовок на прогон: иначе ListItem спросит про дубль через confirm(). */
export function uniqueTitle(prefix = 'E2E') {
  return `${prefix} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Поле формы по тексту его подписи.
 *
 * getByLabel здесь не работает: в ListItem подписи стоят рядом с полем, но не
 * связаны с ним — ни htmlFor, ни вложенности. Для теста это неудобство, для
 * человека с экранным диктором — поле без имени; отмечено отдельно, чинить
 * продуктовый код в рамках правки тестов не стал.
 */
function formField(page: Page, label: string) {
  return page.locator('.form-group').filter({ hasText: label }).locator('input, textarea').first()
}

/**
 * Снимает заслон «сначала фото профиля»: ListItem не показывает форму вовсе,
 * пока в таблице users пусто в avatar_url (см. src/pages/ListItem.tsx).
 * Поле принимает URL строкой, файл загружать не нужно.
 *
 * Вызывается под уже вошедшим владельцем.
 */
export async function ensureProfilePhoto(page: Page) {
  // Сначала смотрим, стоит ли заслон вообще.
  //
  // Прежде аватар ставился БЕЗУСЛОВНО, и делалось это через поле со
  // ссылкой #avatar_url. Такого поля в продукте нет с 13.08: аватар
  // загружается файлом (#avatar_file, PR #28). Оснастка искала исчезнувший
  // элемент и падала на нём — а значит НИ ОДИН сценарий, заводящий вещь,
  // включая «цикл аренды», с того дня не выполнялся вовсе. Playwright не
  // входит в хук перед push, и падение никому не показалось.
  await page.goto('/list-item', { waitUntil: 'load' })
  await dismissCookies(page)
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Ждать формы бесполезно: ListItem рисует её ПЕРВОЙ и только потом,
  // получив ответ про avatar_url, подменяет заслоном. Поэтому решение
  // принимаем после тишины в сети — когда ответ уже пришёл.
  if ((await page.getByText(UI.listItemNeedsPhoto).count()) === 0) {
    await expect(formField(page, UI.listItemTitleLabel)).toBeVisible({ timeout: 15000 })
    return
  }

  await page.goto('/profile', { waitUntil: 'load' })
  await dismissCookies(page)

  // Имя обязательно и уходит тем же запросом, что и ссылка на аватар:
  // пустым оно завалит сохранение целиком.
  const fullName = page.locator('#full_name')
  await expect(fullName).toBeVisible({ timeout: 20000 })
  if (!(await fullName.inputValue())) await fullName.fill('Propriétaire test')

  // Ответ хранилища ловим на лету: всплывашка живёт несколько секунд, и по
  // её отсутствию потом не отличить «не загрузилось» от «не успели».
  const upload = page.waitForResponse(
    r => r.url().includes('/storage/v1/object') && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await page.locator('#avatar_file').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    // Однопиксельный PNG: заслон проверяет непустоту avatar_url, а не картинку.
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  })

  const response = await upload
  if (!response.ok()) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Аватар не загружается: ${response.status()} ${text.slice(0, 200)}\n` +
        'Без него ListItem не отдаёт форму, поэтому весь цикл аренды непроверяем. ' +
        'Это дефект продукта, а не оснастки.',
    )
  }
  await expect(page.getByText(UI.profileAvatarSaved)).toBeVisible({ timeout: 20000 })

  // Заслон читает базу, а не форму — убеждаемся, что запись прошла.
  await expect(async () => {
    await page.goto('/list-item', { waitUntil: 'load' })
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    await expect(page.getByText(UI.listItemNeedsPhoto)).toHaveCount(0)
    await expect(formField(page, UI.listItemTitleLabel)).toBeVisible()
  }).toPass({ timeout: 60000 })
}

export type CreatedItem = { id: string; href: string; title: string; pricePerDay: string }

/**
 * Заводит объявление через интерфейс — тем же путём, что и живой человек.
 * Возврат после перехода на /item/:id, то есть после того, как строка
 * действительно создана.
 */
export async function createItem(
  page: Page,
  opts: {
    title?: string
    pricePerDay?: string
    category?: string
    /**
     * Нажать «Utiliser ma position». По умолчанию НЕ нажимаем — и это осознанно:
     * так объявление заводит человек, который просто напечатал адрес.
     * Координат у такой вещи нет, и поиск «À proximité» её не покажет.
     */
    withPosition?: boolean
    /**
     * Объявить доставку. Поля живут за раскрытием «необязательное» и
     * появляются только после галки — как у живого владельца, который
     * сперва решает, возит он или нет.
     */
    delivery?: { fee: string; radiusKm?: string }
  } = {},
): Promise<CreatedItem> {
  const title = opts.title ?? uniqueTitle()
  const pricePerDay = opts.pricePerDay ?? '12.00'

  // Возвращает страницу уже на /list-item с устоявшейся формой.
  await ensureProfilePhoto(page)

  await formField(page, UI.listItemTitleLabel).fill(title)
  await formField(page, UI.listItemPriceLabel).fill(pricePerDay)
  if (opts.category) {
    await page.locator('select').first().selectOption(opts.category)
  }
  if (opts.delivery) {
    // Раскрытие нативное (<details>): пока оно закрыто, поля не видны и
    // Playwright по ним не кликнет — открываем так же, как человек.
    await page.locator('details.form-details summary').click()
    const toggle = page.locator('#li-delivers')
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await toggle.check()
    // Поля цены до галки не существует вовсе — ждём появления, а не
    // спрашиваем о видимости: is-проверки не ждут.
    const fee = page.locator('#li-delivery-fee')
    await expect(fee).toBeVisible({ timeout: 10000 })
    await fee.fill(opts.delivery.fee)
    if (opts.delivery.radiusKm) await page.locator('#li-delivery-radius').fill(opts.delivery.radiusKm)
  }
  if (opts.withPosition) {
    await page.getByRole('button', { name: /Utiliser ma position/i }).click()
    // Кнопка сама сообщает об успехе — ждём именно её, а не таймаут.
    await expect(page.getByRole('button', { name: /Position enregistrée/i }))
      .toBeVisible({ timeout: 20000 })
  }

  // Дубль по заголовку спрашивают через confirm(); заголовок уникальный,
  // но ответ на всякий случай даём — и снимаем обработчик сразу после,
  // иначе он перехватит чужой диалог позже в сценарии.
  await withDialog(page, true, async () => {
    await page.getByRole('button', { name: UI.listItemSubmit }).click()
  })
  await page.waitForURL(/\/item\/[0-9a-f-]+/i, { timeout: 30000 })

  const id = new URL(page.url()).pathname.split('/').pop()!
  return { id, href: `/item/${id}`, title, pricePerDay }
}

/**
 * Убирает вещь за собой — и падает, если не вышло.
 *
 * Сначала уборка была мягкой: предупреждение в консоль и молча дальше. За
 * один вечер так набралось 11 объявлений на ЖИВОЙ витрине, которую держат
 * пустой намеренно. Мусор, о котором никто не узнаёт, копится всегда.
 */
export async function removeItem(page: Page, id: string) {
  try {
    await page.goto('/my-items', { waitUntil: 'load' })
    await dismissCookies(page)

    const card = page
      .locator('.card')
      .filter({ has: page.locator(`a[href="/item/${id}"]`) })

    // Именно expect, а не card.isVisible(): isVisible проверяет мгновенно и
    // не ждёт, параметр timeout его не удерживает. Кабинет рисуется около
    // двух секунд, поэтому мгновенная проверка стабильно возвращала false, и
    // уборка тихо пропускалась.
    await expect(card).toBeVisible({ timeout: 20000 })

    await withDialog(page, true, async () => {
      await card.getByRole('button', { name: UI.itemDelete }).click()
    })
    await expect(card).toBeHidden({ timeout: 15000 })
  } catch (error) {
    // Молчаливая уборка копит мусор на ЖИВОЙ витрине: 11.08 так набралось
    // 11 объявлений. Провал уборки должен быть слышно.
    throw new Error(
      `[fixtures] не удалось убрать объявление ${id}: ${String(error)}\n` +
        'Проверь витрину и добей: node scripts/cleanup-e2e-items.mjs --apply',
    )
  }
}
