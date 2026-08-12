// Снимок произвольной страницы: node scripts/shot-page.mjs /rental-shops shops
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const path = process.argv[2] || '/'
const name = process.argv[3] || 'page'
const base = process.env.E2E_BASE_URL || 'https://rentit-plum.vercel.app'
mkdirSync('capture', { recursive: true })
const browser = await chromium.launch()
for (const s of [{ n: 'desktop', w: 1280, h: 900 }, { n: 'phone', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h } })
  await ctx.addInitScript(() => {
    localStorage.setItem('rentit_cookie_consent', JSON.stringify({ necessary: true, functional: true, analytics: true }))
    localStorage.setItem('rentit_profile_selected', 'individual')
  })
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `capture/${name}-${s.n}.png`, fullPage: true })
  console.log('снято:', `capture/${name}-${s.n}.png`)
  await ctx.close()
}
await browser.close()
