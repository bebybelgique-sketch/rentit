import { test, expect, Page } from '@playwright/test'

// Учётки берутся из окружения — в репозитории их быть не должно.
// Локально: положить в .env (он в .gitignore) или экспортировать перед прогоном.
const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL ?? ''
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? ''
const RENTER_EMAIL = process.env.TEST_RENTER_EMAIL ?? ''
const RENTER_PASSWORD = process.env.TEST_RENTER_PASSWORD ?? ''
const RENTER_NAME = 'Test Locataire'

const SUPABASE_URL = 'https://zzvwangbomqczyiitigg.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_0OXgoR-4ywTaWZavhhiM7g_uyWxJv2b'

let ownerItemHref = ''

async function dismissCookies(page: Page) {
  await page.waitForTimeout(500)
  try {
    const btn = page.getByRole('button', { name: 'Accept all cookies' })
    if (await btn.isVisible({ timeout: 2000 })) await btn.click()
  } catch { /* already dismissed */ }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'load' })
  await dismissCookies(page)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('button', { name: /déconnexion/i })).toBeVisible({ timeout: 20000 })
}

// Get JWT token from Supabase localStorage (for page.request calls)
async function getTokenFromPage(page: Page): Promise<string> {
  return page.evaluate((url: string) => {
    const raw = localStorage.getItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`) || '{}'
    return JSON.parse(raw).access_token as string
  }, SUPABASE_URL)
}

test.describe('Approval flow', () => {

  test('1. Owner: get first item URL from Mes outils', async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)

    await page.getByRole('link', { name: /mes outils/i }).first().click()
    await page.waitForTimeout(3000)

    await expect(page.getByRole('link', { name: /voir/i }).first()).toBeVisible({ timeout: 10000 })

    const voirLink = page.getByRole('link', { name: /voir/i }).first()
    const href = await voirLink.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).toMatch(/\/item\//)
    ownerItemHref = href!
  })

  test('2. Register or verify renter account', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.locator('input[type="email"]').fill(RENTER_EMAIL)
    await page.locator('input[type="password"]').fill(RENTER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2500)

    const loggedIn = await page.getByRole('button', { name: /déconnexion/i }).isVisible({ timeout: 3000 }).catch(() => false)
    if (loggedIn) return

    await page.goto('/register', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.locator('input').first().fill(RENTER_NAME)
    await page.locator('input[type="email"]').fill(RENTER_EMAIL)
    await page.locator('input[type="password"]').fill(RENTER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(3000)

    const hasConfirm = await page.getByText(/confirm|vérif/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (hasConfirm) test.skip(true, 'Email confirmation required')

    await expect(page.getByRole('button', { name: /déconnexion/i })).toBeVisible({ timeout: 10000 })
  })

  test('3. Renter: sends rental request', async ({ page }) => {
    if (!ownerItemHref) test.skip(true, 'No item URL — test 1 must pass first')

    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    const renterTokenCleanup = await getTokenFromPage(page)

    // Cancel all renter's pending_payment bookings so their dates are unblocked on the calendar
    const ppList = await page.request.get(
      `${SUPABASE_URL}/rest/v1/bookings?select=id&status=eq.pending_payment`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${renterTokenCleanup}` } }
    )
    const ppItems: any[] = await ppList.json().catch(() => [])
    for (const b of Array.isArray(ppItems) ? ppItems : []) {
      const patchRes = await page.request.patch(
        `${SUPABASE_URL}/rest/v1/bookings?id=eq.${b.id}`,
        {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${renterTokenCleanup}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          data: { status: 'cancelled' },
        }
      )
      await patchRes.text()
    }

    // Navigate to item page
    await page.goto(ownerItemHref, { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(2000)

    // Navigate to next month (cleanup above freed all pending_payment dates)
    await page.locator('button').filter({ hasText: '›' }).click()
    await page.waitForTimeout(1500)

    // Wait for calendar days to render
    const availableDays = page.locator('.cal-day.available')
    await expect(availableDays.first()).toBeVisible({ timeout: 10000 })
    const count = await availableDays.count()
    expect(count).toBeGreaterThan(2)

    // Click the 3rd and 6th available day
    await availableDays.nth(2).click()
    await page.waitForTimeout(1000)
    await availableDays.nth(5).click()
    await page.waitForTimeout(1000)

    await expect(page.getByText(/total estimé/i)).toBeVisible({ timeout: 10000 })

    const sendBtn = page.getByRole('button', { name: /envoyer une demande/i })
    await expect(sendBtn).toBeVisible({ timeout: 5000 })

    // Fill message
    await page.locator('textarea').fill('Test Playwright — demande automatique')

    // Intercept response to catch errors
    let respStatus = 0
    let respBody: any = null
    await page.route('**/functions/v1/request-rental', async (route) => {
      const response = await route.fetch()
      respStatus = response.status()
      respBody = await response.json().catch(() => null)
      await route.fulfill({ response })
    })

    await sendBtn.click()
    await page.waitForTimeout(6000)

    // 409 = already have a pending request for these dates — that's fine, test 4 will approve it
    if (respStatus === 409) return

    if (respStatus !== 200) {
      throw new Error(`request-rental failed ${respStatus}: ${JSON.stringify(respBody)}`)
    }

    await expect(page.getByText(/demande envoyée/i)).toBeVisible({ timeout: 10000 })
  })

  test('4. Owner: approves all pending requests via API', async ({ page }) => {
    test.setTimeout(120000)
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000

    // Step A: log in as renter and approve pending bookings as owner
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    const ownerToken = await getTokenFromPage(page)
    expect(ownerToken).toBeTruthy()

    // Approve all pending_approval bookings
    const listRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/bookings?select=id&status=eq.pending_approval`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${ownerToken}` } }
    )
    const listData = await listRes.json().catch(() => [])
    const pending: { id: string }[] = Array.isArray(listData) ? listData : []
    for (const b of pending) {
      await page.request.post(`${SUPABASE_URL}/functions/v1/respond-to-request`, {
        headers: { 'Authorization': `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
        data: { booking_id: b.id, action: 'approve' },
      })
    }

    // Step B: check renter's pending_payment bookings — need at least one with fresh approved_at
    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    const renterToken = await getTokenFromPage(page)

    const ppRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/bookings?select=id,approved_at&status=eq.pending_payment&order=approved_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${renterToken}` } }
    )
    const ppData = await ppRes.json().catch(() => [])
    const pp: { id: string; approved_at: string }[] = Array.isArray(ppData) ? ppData : []
    const hasFresh = pp.length > 0 && (Date.now() - new Date(pp[0].approved_at).getTime()) < TWO_HOURS_MS

    // Step C: if no fresh pending_payment booking exists, create + approve one via API
    if (!hasFresh && ownerItemHref) {
      const itemId = ownerItemHref.split('/item/')[1]
      // Use dates 2 months from now to avoid any existing booking conflicts
      const d = new Date()
      d.setMonth(d.getMonth() + 2)
      d.setDate(1)
      const start = d.toISOString().split('T')[0]
      d.setDate(5)
      const end = d.toISOString().split('T')[0]

      await page.request.post(`${SUPABASE_URL}/functions/v1/request-rental`, {
        headers: { 'Authorization': `Bearer ${renterToken}`, 'Content-Type': 'application/json' },
        data: { item_id: itemId, start_date: start, end_date: end, message: 'Test auto-booking' },
      })

      // Re-login as owner and approve
      await login(page, OWNER_EMAIL, OWNER_PASSWORD)
      const ownerToken2 = await getTokenFromPage(page)
      const listRes2 = await page.request.get(
        `${SUPABASE_URL}/rest/v1/bookings?select=id&status=eq.pending_approval`,
        { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${ownerToken2}` } }
      )
      const listData2 = await listRes2.json().catch(() => [])
      const pending2: { id: string }[] = Array.isArray(listData2) ? listData2 : []
      for (const b of pending2) {
        await page.request.post(`${SUPABASE_URL}/functions/v1/respond-to-request`, {
          headers: { 'Authorization': `Bearer ${ownerToken2}`, 'Content-Type': 'application/json' },
          data: { booking_id: b.id, action: 'approve' },
        })
      }
    }

    // Step D: verify the renter now has a fresh pending_payment booking
    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    const renterToken2 = await getTokenFromPage(page)
    const ppRes2 = await page.request.get(
      `${SUPABASE_URL}/rest/v1/bookings?select=id,approved_at&status=eq.pending_payment&order=approved_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${renterToken2}` } }
    )
    const ppData2 = await ppRes2.json().catch(() => [])
    const pp2: { id: string; approved_at: string }[] = Array.isArray(ppData2) ? ppData2 : []
    expect(pp2.length).toBeGreaterThan(0)
    const freshEnough = (Date.now() - new Date(pp2[0].approved_at).getTime()) < TWO_HOURS_MS
    expect(freshEnough).toBe(true)

    // Step E: navigate to owner's My Items and verify no pending approvals in UI
    await login(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.getByRole('link', { name: /mes outils/i }).first().click()
    await page.waitForTimeout(3000)
    const tousTab = page.getByRole('button', { name: /^tous$/i })
    if (await tousTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tousTab.click()
      await page.waitForTimeout(1000)
    }
    await expect(page.getByRole('button', { name: /approuver/i }).first()).not.toBeVisible({ timeout: 10000 })
  })

  test('5. Renter: sees approved status and Pay button', async ({ page }) => {
    await login(page, RENTER_EMAIL, RENTER_PASSWORD)
    const renterToken = await getTokenFromPage(page)

    // Get the renter's most recently approved booking (fresh approved_at = most recent first)
    const ppRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/bookings?select=id&status=eq.pending_payment&order=approved_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${renterToken}` } }
    )
    const ppData = await ppRes.json().catch(() => [])
    const pendingPayment: { id: string }[] = Array.isArray(ppData) ? ppData : []
    expect(pendingPayment.length).toBeGreaterThan(0)

    const bookingId = pendingPayment[0].id
    await page.goto(`/pay/${bookingId}`, { waitUntil: 'load' })

    await expect(page).toHaveURL(/\/pay\//, { timeout: 8000 })
    await expect(page.getByText(/finaliser le paiement/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/temps restant/i)).toBeVisible({ timeout: 10000 })
  })

  test('6. /pay/:id redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/pay/00000000-0000-0000-0000-000000000000', { waitUntil: 'load' })
    await dismissCookies(page)
    await page.waitForTimeout(2500)

    const onLogin = page.url().includes('/login')
    const hasLoginCTA = await page.getByRole('link', { name: /se connecter/i }).isVisible({ timeout: 5000 }).catch(() => false)
    expect(onLogin || hasLoginCTA).toBe(true)
  })
})
