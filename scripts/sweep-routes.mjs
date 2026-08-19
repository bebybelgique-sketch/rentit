// Обход всех маршрутов: где страница пустая, где нет выхода, где ругается консоль.
//
// Это ДИАГНОСТИКА, а не гейт: она сообщает наблюдения, а не выносит вердикт.
// Запуск: node scripts/sweep-routes.mjs [адрес]
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()] })
)
const BASE = process.argv[2] || 'https://rentit-plum.vercel.app'

const ROUTES = [
  '/', '/browse', '/login', '/register', '/forgot-password', '/reset-password',
  '/privacy', '/terms', '/rental-shops',
  '/list-item', '/edit-item/00000000-0000-0000-0000-000000000000',
  '/my-items', '/my-rentals', '/profile', '/admin',
  '/item/00000000-0000-0000-0000-000000000000',
  '/такой-страницы-нет',
]

const browser = await chromium.launch()

async function sweep(label, authed) {
  const context = await browser.newContext()
  const page = await context.newPage()

  if (authed) {
    await page.goto(`${BASE}/login`, { waitUntil: 'load' })
    // Баннер печенья перехватывает клики: без этого вход не нажимается вовсе.
    await page.getByRole('button', { name: /Accepter|Tout accepter|Accept/i }).first()
      .click({ timeout: 5000 }).catch(() => {})
    await page.locator('#email, input[type="email"]').first().fill(env.TEST_OWNER_EMAIL)
    await page.locator('#password, input[type="password"]').first().fill(env.TEST_OWNER_PASSWORD)
    await page.getByRole('button', { name: /Se connecter|Connexion|Log in/i }).first().click()
    await page.waitForURL(u => !u.pathname.endsWith('/login'), { timeout: 30000 }).catch(() => {})
  }

  console.log(`\n=== ${label} ===`)
  for (const route of ROUTES) {
    const errors = []
    const bad = []
    const onConsole = m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) }
    const onResponse = r => { if (r.status() >= 400 && !r.url().includes('/rest/v1/rpc/')) bad.push(`${r.status()} ${new URL(r.url()).pathname}`) }
    page.on('console', onConsole)
    page.on('response', onResponse)

    await page.goto(BASE + route, { waitUntil: 'load' }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    // Печенье закрываем, иначе оно считается «содержимым» на каждой странице.
    await page.getByRole('button', { name: /Accepter|Tout accepter|Accept/i }).first()
      .click({ timeout: 1500 }).catch(() => {})

    const text = (await page.locator('body').innerText().catch(() => '')).trim()
    const here = new URL(page.url()).pathname
    // Выход со страницы: любая ссылка навигации внутрь продукта.
    const exits = await page.locator('a[href^="/"], a[href^="http"]').count().catch(() => 0)
    const buttons = await page.getByRole('button').count().catch(() => 0)

    page.off('console', onConsole)
    page.off('response', onResponse)

    const flags = []
    if (text.length < 40) flags.push('ПУСТАЯ')
    if (exits === 0) flags.push('НЕТ ВЫХОДА')
    if (here !== route && !(route === '/такой-страницы-нет')) flags.push(`перенаправление → ${here}`)
    if (errors.length) flags.push(`консоль: ${errors.length}`)
    if (bad.length) flags.push(`ответы: ${[...new Set(bad)].join(', ')}`)

    console.log(
      `${route.padEnd(46)} текст ${String(text.length).padStart(5)}  ссылок ${String(exits).padStart(3)}  кнопок ${String(buttons).padStart(3)}` +
      (flags.length ? `  ⚠ ${flags.join(' · ')}` : '  ok'),
    )
    if (errors.length) errors.slice(0, 2).forEach(e => console.log(`      консоль: ${e}`))
  }
  await context.close()
}

await sweep('аноним', false)
await sweep('владелец (вошёл)', true)
await browser.close()
