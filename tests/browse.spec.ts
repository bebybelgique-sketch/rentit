import { test, expect } from '@playwright/test'
import { UI, CATEGORY_LABEL, skipModals } from './helpers/app'
import { seedCatalogItem, unseedCatalogItem, type CreatedItem } from './helpers/fixtures'

test.describe('витрина', () => {
  // Витрина прячет чипы, «À proximité», «Filtres» и радиус, когда каталог
  // пуст: фильтровать нечего, и орган управления был бы тупиком. Решение
  // верное — но проверять фильтры на пустой витрине значит не проверять
  // фильтры. Одна вещь на весь файл, и она убирается за собой.
  test.skip(!process.env.TEST_OWNER_EMAIL || !process.env.TEST_OWNER_PASSWORD, 'Нет учётки владельца в окружении')

  let seeded: CreatedItem | null = null

  test.beforeAll(async ({ browser }) => {
    seeded = await seedCatalogItem(browser, 'E2E витрина')
  })

  test.afterAll(async ({ browser }) => {
    await unseedCatalogItem(browser, seeded)
    seeded = null
  })

  test.beforeEach(async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })
  })

  test('открывается и показывает поиск', async ({ page }) => {
    await expect(page).toHaveURL(/\/browse/)
    const search = page.getByPlaceholder(UI.browseSearchPlaceholder)
    await expect(search).toBeVisible({ timeout: 10000 })
    await search.fill('perceuse')
    await expect(search).toHaveValue('perceuse')
  })

  test('показывает все шесть категорий кнопками', async ({ page }) => {
    for (const label of Object.values(CATEGORY_LABEL)) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10000 })
    }
  })

  test('переключатель «сетка / карта» на месте', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Grille' })).toBeVisible({ timeout: 10000 })
    const map = page.getByRole('button', { name: 'Carte' })
    await expect(map).toBeVisible()

    // Карта должна действительно открываться, а не быть подписью.
    await map.click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 })
  })

  test('выбор категории не роняет страницу', async ({ page }) => {
    const chip = page.getByRole('button', { name: CATEGORY_LABEL.garden, exact: true })
    await expect(chip).toBeVisible({ timeout: 10000 })
    await chip.click()

    // Что бы ни нашлось, страница обязана остаться живой и отвечать:
    // либо карточки, либо внятная пустота.
    await expect(
      page.locator('.item-card').first().or(page.getByRole('heading', { name: UI.browseEmptyHeading })),
    ).toBeVisible({ timeout: 15000 })
  })

  // ИНВАРИАНТ ТОТ ЖЕ, ПОСЫЛКА ДРУГАЯ. Прежняя версия этой проверки ждала
  // ПУСТОГО КАТАЛОГА и требовала на нём кнопку «Élargir à 50 km». Обе
  // половины устарели, и обе — намеренно:
  //
  //   • каталог тут больше не пуст: файл заводит себе вещь, иначе чипы и
  //     фильтры скрыты и проверять их нечем. Проверка, которая при наличии
  //     вещей просто пропускалась (`test.skip`), не охраняла ничего;
  //   • кнопки расширения на ПУСТОМ каталоге больше нет: она вела во второй
  //     такой же пустой экран, и продукт теперь говорит об этом вслух.
  //
  // Инвариант остался прежним: пустота объясняет себя и не ведёт в тупик.
  // Здесь он проверяется на том пустом экране, который у витрины с каталогом
  // и бывает, — когда фильтр не нашёл ничего. На нём расширение зоны как раз
  // осмысленно, поэтому кнопка обязана быть.
  test('фильтр без находок объясняет пустоту и даёт выход', async ({ page }) => {
    await page.getByPlaceholder(UI.browseSearchPlaceholder)
      .fill('zzz-такого-инструмента-нет-zzz')

    await expect(page.getByRole('heading', { name: UI.browseEmptyHeading }))
      .toBeVisible({ timeout: 15000 })
    await expect(page.locator('.item-card')).toHaveCount(0)

    // Выход с этого экрана есть, и он ведёт туда, где что-то найдётся.
    await expect(page.getByRole('button', { name: /Élargir à 50 km/i })).toBeVisible()
  })
})
