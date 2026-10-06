import { test, expect } from '@playwright/test'
import { UI, skipModals } from './helpers/app'

/**
 * Поиск на витрине и разбор ?q= из адреса.
 *
 * Проверка «найденное действительно отфильтровано» требует инструмента в базе
 * и живёт в showcase.spec.ts вместе с оснасткой. Здесь — только то, что
 * проверяемо на пустой витрине: запрос доезжает до адреса и до поля.
 *
 * 12.08: два теста отсюда проверяли поиск С ЛЕНДИНГА — строку «QUOI / OÙ»
 * первым экраном. Её больше нет: лендинг обращён к владельцу инструмента,
 * а не к арендатору, и при нуле объявлений искать с него было нечего.
 * Проверки не выброшены, а переставлены на витрину — туда, где поиск и
 * живёт. Выбросить их вместе с местом значило бы снять охрану с работающей
 * возможности заодно с удалённой.
 *
 * 05.10: поиск снова и на первом экране — см. тест ниже.
 */
test.describe('поиск', () => {
  test('поиск на витрине не даёт тупика на пустой выдаче', async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse', { waitUntil: 'load' })

    const input = page.getByPlaceholder(UI.browseSearchPlaceholder)
    await expect(input).toBeVisible({ timeout: 15000 })
    await input.fill('Bosch')

    // Витрина фильтрует на месте: запрос в адрес НЕ пишется, ?q= она
    // только читает (см. тест ниже). Значит и проверять надо не адрес, а
    // то, что человек видит: объяснение и выход, а не пустой экран.
    await expect(page.getByRole('link', { name: /déposer/i }).first()).toBeVisible({ timeout: 15000 })
  })

  // 05.10 поиск вернулся на первый экран (решение Рамзана 04.10, довод — в
  // шапке HeroSection.tsx). Прежняя проверка «поисковой строки нет» упала
  // вместе с решением. Охраняется теперь то, ради чего строку раньше и
  // снимали: она не должна быть фальшивой — запрос обязан доехать до
  // витрины, а путь владельца остаться на первом экране.
  test('поиск первого экрана доезжает до витрины, путь владельца на месте', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })

    const owner = page.getByRole('link', { name: /déposez/i }).first()
    await expect(owner).toBeVisible({ timeout: 10000 })
    await expect(owner).toHaveAttribute('href', '/list-item')

    const search = page.getByRole('search')
    await search.getByLabel('Quoi ?').fill('Karcher')
    await search.getByLabel('Quand ?').selectOption('this')
    await search.getByRole('button', { name: /rechercher/i }).click()

    await expect(page).toHaveURL(/\/browse\?q=Karcher&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/, { timeout: 15000 })
    await expect(page.getByPlaceholder(UI.browseSearchPlaceholder)).toHaveValue('Karcher', { timeout: 15000 })
  })

  test('?q= из адреса подставляется в поле витрины', async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse?q=Karcher', { waitUntil: 'load' })

    // Запрос обязан доехать до поля: иначе человек видит отфильтрованную
    // выдачу и пустую строку поиска, и не понимает, почему мало результатов.
    await expect(page.getByPlaceholder(UI.browseSearchPlaceholder)).toHaveValue('Karcher', { timeout: 15000 })
  })
})
