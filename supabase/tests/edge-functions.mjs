// Прогон edge-функций: прямые вызовы РАЗВЁРНУТЫХ функций на живой базе.
//
// Зачем отдельный прогон, если в проекте уже четыре гейта. Затем, что
// НИ ОДИН из них не видит папку supabase/functions/ — это замерено 12.08:
//
//   npx tsc --noEmit             tsconfig.json → include: ["src"]
//   node scripts/check-claims.mjs  SCAN_DIRS: ['src', 'public']
//   npm run build                vite собирает фронт
//   npx playwright test          браузер зовёт РАЗВЁРНУТУЮ функцию по HTTP,
//                                а не файл на диске
//
// В тот день это дало три подряд отчёта «проверки прошли» о правках,
// которые ни одна проверка не могла увидеть, и один настоящий баг —
// бронь на сегодня отклонялась, — всплывший только когда функцию
// развернули и позвали руками.
//
// Отсюда правило прогона: он бьёт по РАЗВЁРНУТЫМ функциям, а не по коду.
// Значит перед ним нужен deploy, иначе он проверит вчерашнюю версию:
//
//   npx supabase functions deploy <имя>
//   npm run test:edge
//
// Оснастку он создаёт сам и сам убирает: объявлений в базе намеренно
// ноль, и прогон обязан оставлять их нулём.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()] })
)

const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'TEST_OWNER_EMAIL', 'TEST_OWNER_PASSWORD', 'TEST_RENTER_EMAIL', 'TEST_RENTER_PASSWORD']
const missing = need.filter(k => !env[k])
if (missing.length) {
  console.error(`В .env не хватает: ${missing.join(', ')}`)
  process.exit(1)
}

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

let passed = 0
let failed = 0
const check = (ok, label, detail = '') => {
  if (ok) { passed++; console.log(`  ok      ${label}`) }
  else { failed++; console.log(`  ПРОВАЛ  ${label}${detail ? ` → ${detail}` : ''}`) }
}

const owner = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const renter = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const { error: eO } = await owner.auth.signInWithPassword({ email: env.TEST_OWNER_EMAIL, password: env.TEST_OWNER_PASSWORD })
const { error: eR } = await renter.auth.signInWithPassword({ email: env.TEST_RENTER_EMAIL, password: env.TEST_RENTER_PASSWORD })
if (eO || eR) { console.error('вход тестовых учёток не удался:', (eO || eR).message); process.exit(1) }

const { data: ownerUser } = await owner.auth.getUser()
let itemId = null

try {
  // ── Оснастка ────────────────────────────────────────────────────────
  // Заголовок с префиксом «E2E » узнаёт scripts/cleanup-e2e-items.mjs —
  // если прогон оборвётся, уборка найдёт остаток по нему.
  const { data: item, error: itemErr } = await owner.from('items').insert([{
    owner_id: ownerUser.user.id,
    title: 'E2E прогон edge-функций',
    description: 'Временная запись прогона supabase/tests/edge-functions.mjs.',
    category: 'power_tools',
    condition: 'good',
    price_per_day: 10,
    deposit: 50,
    available: true,
    address: 'Wavre',
  }]).select('id').single()
  if (itemErr) throw new Error(`не удалось создать предмет: ${itemErr.code} ${itemErr.message}`)
  itemId = item.id

  const ask = async (body, as = renter) => {
    const { data, error } = await as.functions.invoke('request-rental', { body })
    return { bookingId: data?.booking_id ?? null, err: data?.error ?? (error ? error.message : null) }
  }

  // ── request-rental ──────────────────────────────────────────────────
  console.log('\nrequest-rental')

  // Самый частый случай проката инструмента: «нужен сегодня». Ломался
  // 12.08 проверкой `start.getTime() < Date.now()`, потому что дата вида
  // YYYY-MM-DD разбирается как полночь UTC.
  const today = await ask({ item_id: itemId, start_date: day(0), end_date: day(1) })
  check(!!today.bookingId, 'бронь на СЕГОДНЯ проходит', today.err)
  if (today.bookingId) await owner.from('bookings').delete().eq('id', today.bookingId)

  const past = await ask({ item_id: itemId, start_date: day(-1), end_date: day(1) })
  check(!past.bookingId, 'вчерашняя дата отклоняется')

  const reversed = await ask({ item_id: itemId, start_date: day(5), end_date: day(2) })
  check(!reversed.bookingId, 'end < start отклоняется')

  const garbage = await ask({ item_id: itemId, start_date: 'не-дата', end_date: day(2) })
  check(!garbage.bookingId, 'нечитаемая дата отклоняется')

  const missingFields = await ask({ item_id: itemId })
  check(!missingFields.bookingId, 'без дат отклоняется')

  const own = await ask({ item_id: itemId, start_date: day(2), end_date: day(3) }, owner)
  check(!own.bookingId, 'свой предмет забронировать нельзя')

  const ghost = await ask({ item_id: '00000000-0000-0000-0000-000000000000', start_date: day(2), end_date: day(3) })
  check(!ghost.bookingId, 'несуществующий предмет отклоняется')

  // Цена считается сервером и обязана совпадать с генерируемой колонкой
  // базы: total_days = end_date - start_date + 1. Расхождение между ними
  // означает, что человеку выставили не то число дней, что записано.
  const priced = await ask({ item_id: itemId, start_date: day(2), end_date: day(4) })
  if (priced.bookingId) {
    const { data: b } = await owner.from('bookings').select('total_days, total_price').eq('id', priced.bookingId).single()
    check(b?.total_days === 3, 'три календарных дня считаются как 3', `получено ${b?.total_days}`)
    check(Number(b?.total_price) === 30, 'цена = 10/день × 3 дня', `получено ${b?.total_price}`)
    await owner.from('bookings').delete().eq('id', priced.bookingId)
  } else {
    check(false, 'бронь для проверки цены создалась', priced.err)
  }

  const unauth = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/request-rental`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, start_date: day(2), end_date: day(3) }),
  })
  check(unauth.status === 401, 'без авторизации отвечает 401', `HTTP ${unauth.status}`)

  // ── Снятые функции платной модели ───────────────────────────────────
  // Сторож против случайного возврата: 12.08 пять функций Stripe были
  // сняты с развёртывания и уехали в parked/. Если какая-то вернётся
  // молча — здесь это станет видно.
  console.log('\nснятая платная модель')
  for (const fn of ['stripe-webhook', 'create-payment-intent', 'create-rental-intent', 'create-pro-checkout', 'create-business-checkout']) {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    check(r.status === 404, `${fn} не развёрнута`, `HTTP ${r.status}`)
  }

  // ── Контакты закрыты ────────────────────────────────────────────────
  // Обещание продукта: телефон второй стороны — только после
  // подтверждённой брони. Закрыто грантом столбца (миграция
  // 20260811000014), а не политикой: RLS фильтрует строки, а закрыть надо
  // столбец. Проверяем, что грант на месте — файл миграции ничего не
  // доказывает, здесь их применяют руками.
  console.log('\nконтакты закрыты')
  const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  for (const [client, who] of [[anon, 'аноним'], [renter, 'залогиненный']]) {
    const { error } = await client.from('users').select('id, phone').limit(1)
    check(error?.code === '42501', `${who} не читает phone`, error ? error.code : 'запрос ПРОШЁЛ')
  }
  const { error: eGeo } = await renter.from('users').select('id, lat, lng').limit(1)
  check(eGeo?.code === '42501', 'домашние координаты закрыты', eGeo ? eGeo.code : 'запрос ПРОШЁЛ')

} catch (err) {
  failed++
  console.log(`\nПРОВАЛ прогона: ${err.message}`)
} finally {
  // Уборка обязательна: витрина пуста намеренно, и прогон не имеет права
  // оставить на ней запись. Удаление предмета каскадом снимает и брони.
  if (itemId) await owner.from('items').delete().eq('id', itemId)
  const { count: items } = await owner.from('items').select('id', { count: 'exact', head: true })
  const { count: bookings } = await owner.from('bookings').select('id', { count: 'exact', head: true })
  console.log(`\nуборка: items ${items}, bookings ${bookings}`)
  if (items !== 0) { failed++; console.log('  ПРОВАЛ  на витрине остались записи прогона') }
  await owner.auth.signOut()
  await renter.auth.signOut()
}

console.log(`\nитог: ${passed} прошло, ${failed} провалено`)
process.exit(failed ? 1 : 0)
