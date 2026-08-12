// Снимки диаграмм: правку SVG нельзя принимать по коду, только по картинке.
import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
mkdirSync('capture', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1320, height: 1100 } })
for (const f of ['booking-state-machine', 'browse-data-flow']) {
  await page.goto(pathToFileURL(`docs/diagrams/${f}.html`).href, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `capture/diag-${f}.png`, fullPage: true })
  console.log('снято', f)
}
await browser.close()
