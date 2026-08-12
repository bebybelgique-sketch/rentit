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
  // Аватар ставим безусловно, а не «если стоит заслон».
  //
  // Проверять заслон опросом нельзя: ListItem сначала рисует форму и только
  // потом, когда вернётся запрос avatar_url, подменяет её заглушкой. Опрос
  // успевал заглянуть в промежуток, решить «заслона нет» и уйти заполнять
  // форму — а та отрывалась от DOM прямо посреди ввода. Гонку не сторожат,
  // её убирают: ставим аватар всегда, потом ждём устоявшегося состояния.
  //
  // Поле на /profile заполняется из user_metadata, а не из таблицы users
  // (см. src/pages/Profile.tsx), поэтому оно выглядит пустым даже когда в базе
  // значение есть. Лишняя перезапись тем же значением безвредна.
  await page.goto('/profile', { waitUntil: 'load' })
  await dismissCookies(page)

  // Имя обязательно (required) и больше НЕ подставляется почтой: подстановка
  // публиковала адрес человека, потому что full_name читается анонимом.
  // Пустое обязательное поле блокирует отправку формы целиком — заполняем,
  // как заполнил бы человек.
  const fullName = page.locator('#full_name')
  await expect(fullName).toBeVisible({ timeout: 20000 })
  if (!(await fullName.inputValue())) await fullName.fill('Propriétaire test')

  const avatar = page.locator('#avatar_url')
  await expect(avatar).toBeVisible({ timeout: 20000 })
  // Прозрачный пиксель data-URI: заслон проверяет непустоту поля, а не картинку,
  // и внешний адрес сюда тянуть незачем — он однажды перестанет отвечать.
  await avatar.fill(
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  )
  // Ответ сервера ловим на лету: всплывашка живёт ~4 с, а по её отсутствию
  // потом уже не отличить «не сохранилось» от «не успели посмотреть».
  const saveResponse = page.waitForResponse(
    r => r.request().method() === 'PATCH' && r.url().includes('/rest/v1/users'),
    { timeout: 20000 },
  )
  await page.getByRole('button', { name: UI.profileSubmit }).click()

  const response = await saveResponse
  if (!response.ok()) {
    const body = await response.text().catch(() => '')
    // Называем причину здесь, иначе прогон падал через три шага на «нет поля
    // цены» — симптом, по которому до настоящей причины не дойти.
    throw new Error(
      `Профиль не сохраняется: ${response.status()} ${body.slice(0, 200)}\n` +
        'Без аватара ListItem не отдаёт форму, поэтому весь цикл аренды непроверяем. ' +
        'Это дефект продукта, а не оснастки.',
    )
  }

  // Уходить со страницы сразу после клика нельзя — уход обрывает запрос.
  await expect(page.getByText(UI.profileSaved)).toBeVisible({ timeout: 20000 })

  // Заслон читает базу, а не форму — убеждаемся, что запись действительно
  // прошла, и дожидаемся, пока страница перестанет переобуваться.
  //
  // Ждать появления формы бесполезно: ListItem рисует её ПЕРВОЙ и только
  // потом, получив ответ про avatar_url, подменяет заслоном. Значит ждать
  // надо не элемент, а тишину в сети — момент, когда решение уже принято.
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
     * Нажать «📍 Ma position». По умолчанию НЕ нажимаем — и это осознанно:
     * так объявление заводит человек, который просто напечатал адрес.
     * Координат у такой вещи нет, и поиск «À proximité» её не покажет.
     */
    withPosition?: boolean
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
  if (opts.withPosition) {
    await page.getByRole('button', { name: /Ma position/ }).click()
    // Кнопка сама сообщает об успехе — ждём именно её, а не таймаут.
    await expect(page.getByRole('button', { name: /Position définie/ }))
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
