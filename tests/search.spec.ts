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

  test('на лендинге поисковой строки нет — он обращён к владельцу', async ({ page }) => {
    await skipModals(page)
    await page.goto('/', { waitUntil: 'load' })

    // Первое действие лендинга — выложить инструмент, а не искать чужой.
    const primary = page.getByRole('link', { name: /déposer un outil/i }).first()
    await expect(primary).toBeVisible({ timeout: 10000 })
    await expect(primary).toHaveAttribute('href', '/list-item')
    await expect(page.getByPlaceholder(UI.browseSearchPlaceholder)).toHaveCount(0)
  })

  test('?q= из адреса подставляется в поле витрины', async ({ page }) => {
    await skipModals(page)
    await page.goto('/browse?q=Karcher', { waitUntil: 'load' })

    // Запрос обязан доехать до поля: иначе человек видит отфильтрованную
    // выдачу и пустую строку поиска, и не понимает, почему мало результатов.
    await expect(page.getByPlaceholder(UI.browseSearchPlaceholder)).toHaveValue('Karcher', { timeout: 15000 })
  })
})
