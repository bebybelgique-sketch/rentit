// Прожимает каждую кнопку на странице и смотрит, изменилось ли ХОТЬ ЧТО-ТО:
// адрес, содержимое страницы или сетевой запрос. Кнопка, после которой не
// изменилось ничего, — кандидат в «не работает».
//
// ДИАГНОСТИКА, не гейт: «ничего не изменилось» бывает и законным (кнопка
// открывает системное окно, которое браузер в этом режиме не показывает).
// Скрипт сообщает наблюдение, вывод делает человек.
//
// Пишущие кнопки пропускаются по названию: прогон не должен ничего создавать.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()] })
)
const BASE = process.argv[2] || 'https://rentit-plum.vercel.app'
const SKIP = /Supprimer|Delete|Déconnexion|Publier|Mettre à jour|Enregistrer|Envoyer|Accepter|Refuser|S'inscrire|Se connecter|Réinitialiser|Annuler/i

const PAGES = ['/', '/browse', '/login', '/register', '/forgot-password', '/rental-shops', '/privacy', '/terms', '/my-items', '/my-rentals', '/profile', '/list-item']

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'load' })
await page.getByRole('button', { name: /Accepter|Tout accepter/i }).first().click({ timeout: 5000 }).catch(() => {})
await page.locator('input[type="email"]').first().fill(env.TEST_OWNER_EMAIL)
await page.locator('input[type="password"]').first().fill(env.TEST_OWNER_PASSWORD)
await page.getByRole('button', { name: /Se connecter/i }).first().click()
await page.waitForURL(u => !u.pathname.endsWith('/login'), { timeout: 30000 }).catch(() => {})

let silent = 0
for (const route of PAGES) {
  console.log(`\n── ${route}`)
  await page.goto(BASE + route, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const names = await page.getByRole('button').evaluateAll(ns => ns.map(n => (n.innerText || n.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()))

  for (let i = 0; i < names.length; i++) {
    const name = names[i] || '(без подписи)'
    if (SKIP.test(name)) { console.log(`   ⏭  ${name} — пишущая, пропущена`); continue }

    await page.goto(BASE + route, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    const before = { url: page.url(), text: await page.locator('body').innerText().catch(() => '') }
    let requests = 0
    const onReq = () => { requests++ }
    page.on('request', onReq)

    // Имя читаем ЗДЕСЬ, после перехода, а не из списка, снятого один раз в
    // начале: страница дорисовывается (аватар, счётчики), порядок кнопок
    // сдвигается, и щуп сообщал «кнопка без подписи» про кнопку, которой
    // на этом месте уже не было. Свой инструмент врал ровно тем же
    // способом, что и проверяемый продукт.
    const btn = page.getByRole('button').nth(i)
    const shown = (await btn.innerText().catch(() => '')).replace(/s+/g, ' ').trim() || name
    const clicked = await btn.click({ timeout: 5000 }).then(() => true).catch(() => false)
    await page.waitForTimeout(900)
    page.off('request', onReq)

    if (!clicked) { console.log(`   ⚠  ${shown} — КЛИК НЕ ПРОШЁЛ (перекрыта или отключена)`); silent++; continue }

    const after = { url: page.url(), text: await page.locator('body').innerText().catch(() => '') }
    const changed = after.url !== before.url || after.text !== before.text || requests > 0
    if (changed) {
      const what = after.url !== before.url ? `адрес → ${new URL(after.url).pathname}`
        : after.text !== before.text ? 'содержимое' : `${requests} запрос(ов)`
      console.log(`   ok ${shown} — ${what}`)
    } else {
      console.log(`   ⚠  ${shown} — НИЧЕГО НЕ ИЗМЕНИЛОСЬ`)
      silent++
    }
  }
}
console.log(`\nмолчаливых кнопок: ${silent}`)
await browser.close()
