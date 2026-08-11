import { expect, type Page } from '@playwright/test'
import { UI, dismissCookies } from './app'

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
  opts: { title?: string; pricePerDay?: string; category?: string } = {},
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

  // Дубль по заголовку спрашивают через confirm(); заголовок уникальный,
  // но обработчик оставляем — без него диалог повесит прогон.
  page.on('dialog', dialog => dialog.accept().catch(() => {}))

  await page.getByRole('button', { name: UI.listItemSubmit }).click()
  await page.waitForURL(/\/item\/[0-9a-f-]+/i, { timeout: 30000 })

  const id = new URL(page.url()).pathname.split('/').pop()!
  return { id, href: `/item/${id}`, title, pricePerDay }
}

/**
 * Убирает вещь за собой. Не роняет тест, если удалить не вышло: незакрытая
 * уборка — это мусор в базе, а не провал проверяемого сценария. О мусоре
 * сообщаем в консоль, чтобы он не копился молча.
 */
export async function removeItem(page: Page, id: string) {
  try {
    await page.goto('/my-items', { waitUntil: 'load' })
    await dismissCookies(page)

    const card = page
      .locator('.card')
      .filter({ has: page.locator(`a[href="/item/${id}"]`) })

    if (!(await card.isVisible({ timeout: 10000 }).catch(() => false))) return

    page.on('dialog', dialog => dialog.accept().catch(() => {}))
    await card.getByRole('button', { name: UI.itemDelete }).click()
    await expect(card).toBeHidden({ timeout: 15000 })
  } catch (error) {
    console.warn(`[fixtures] объявление ${id} осталось в базе: ${String(error)}`)
  }
}
