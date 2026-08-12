// Снимки страницы вещи «до / после».
//
// Страница вещи — точка, где обещание продукта либо выполняется, либо нет:
// витрина только приводит, бронь оформляют здесь. Правки её геометрии нельзя
// принимать по диффу.
//
// Вещь заводится через API (а не через форму) и удаляется в конце: на живой
// витрине она живёт секунды и только ради снимка.
//
//   node scripts/shot-item.mjs before
//   node scripts/shot-item.mjs after
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
}

const label = process.argv[2] || 'shot'
const base = process.env.E2E_BASE_URL || 'https://rentit-plum.vercel.app'
const dir = `capture/item/${label}`
mkdirSync(dir, { recursive: true })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_OWNER_EMAIL,
  password: process.env.TEST_OWNER_PASSWORD,
})
if (authErr) { console.error('вход не удался:', authErr.message); process.exit(1) }

// Вавр — центр региона продукта.
const { data: item, error: insErr } = await supabase.from('items').insert([{
  owner_id: auth.user.id,
  title: 'E2E снимок · Perceuse Bosch GSB 18V',
  description: 'Perceuse-visseuse à percussion, 2 batteries 4 Ah, chargeur et coffret. Idéale pour béton, bois et métal.',
  category: 'power_tools',
  condition: 'good',
  price_per_day: 14,
  deposit: 50,
  photos: [],
  lat: 50.7167, lng: 4.6167,
  address: 'Wavre, Brabant wallon',
  available: true,
}]).select('id').single()
if (insErr) { console.error('вещь не создалась:', insErr.message); process.exit(1) }

try {
  const browser = await chromium.launch()
  for (const size of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } })
    await context.addInitScript(() => {
      localStorage.setItem('rentit_cookie_consent',
        JSON.stringify({ necessary: true, functional: true, analytics: true }))
      localStorage.setItem('rentit_profile_selected', 'individual')
    })
    const page = await context.newPage()
    await page.goto(`${base}/item/${item.id}`, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    const file = `${dir}/item-${size.name}.png`
    await page.screenshot({ path: file, fullPage: true })
    console.log('снято:', file)
    await context.close()
  }
  await browser.close()
} finally {
  const { error: delErr } = await supabase.from('items').delete().eq('id', item.id)
  console.log(delErr ? `НЕ УДАЛЕНА ${item.id}: ${delErr.message}` : 'вещь удалена, витрина чистая')
}
