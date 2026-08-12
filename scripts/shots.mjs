// Снимки живых страниц для сверки «до / после».
//
// Правки геометрии нельзя принимать по диффу: цифры в коде ничего не говорят
// о том, стало ли на экране спокойнее. Снимок — единственное доказательство.
//
//   node scripts/shots.mjs before
//   node scripts/shots.mjs after
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const label = process.argv[2] || 'shot'
const base = process.env.E2E_BASE_URL || 'https://rentit-plum.vercel.app'
const dir = `capture/geometry/${label}`
mkdirSync(dir, { recursive: true })

const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'browse', path: '/browse' },
  { name: 'login', path: '/login' },
]
const SIZES = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

const browser = await chromium.launch()
for (const size of SIZES) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
  })
  // Баннер cookies и выбор профиля перекрывают экран — гасим до загрузки.
  await context.addInitScript(() => {
    localStorage.setItem('rentit_cookie_consent',
      JSON.stringify({ necessary: true, functional: true, analytics: true }))
    localStorage.setItem('rentit_profile_selected', 'individual')
  })

  const page = await context.newPage()
  for (const p of PAGES) {
    await page.goto(base + p.path, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1200) // шрифты и разметка после подгрузки
    const file = `${dir}/${p.name}-${size.name}.png`
    await page.screenshot({ path: file, fullPage: true })
    console.log(`снято: ${file}`)
  }
  await context.close()
}
await browser.close()
