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

// Необязательные переменные — раздел admin-action.
//
// TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD — учётка с users.role = 'admin'.
// Роль ей выставляют ОДИН раз руками в SQL-консоли: сделать это из клиента
// нельзя, и ровно в этом смысл проверяемой функции.
//
// SUPABASE_SERVICE_ROLE_KEY — только чтобы прочитать admin_audit_log.
// Журнал закрыт для anon и authenticated намеренно (RLS без политик,
// гранты сняты), поэтому без служебного ключа проверки записи в журнал
// ПРОПУСКАЮТСЯ, а не считаются пройденными. Ключ берётся из окружения и в
// репозиторий не попадает.
const hasAdmin = !!(env.TEST_ADMIN_EMAIL && env.TEST_ADMIN_PASSWORD)
const service = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)

let passed = 0
let failed = 0
let skipped = 0
const check = (ok, label, detail = '') => {
  if (ok) { passed++; console.log(`  ok      ${label}`) }
  else { failed++; console.log(`  ПРОВАЛ  ${label}${detail ? ` → ${detail}` : ''}`) }
}
// Пропуск — это НЕ «прошло». Печатаем его отдельной пометкой и считаем,
// иначе прогон без админской учётки выглядел бы полностью зелёным, ничего
// не проверив в admin-action.
const skip = (label, why) => { skipped++; console.log(`  пропуск ${label} → ${why}`) }

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

  // ── Доставка ────────────────────────────────────────────────────────
  // Признак услуги ровно один — непустая items.delivery_fee. Пока её нет,
  // заявка с доставкой обязана быть отклонена: иначе бронь унесёт
  // обещание, которого владелец не давал.
  const noService = await ask({ item_id: itemId, start_date: day(6), end_date: day(7), delivery_requested: true })
  check(!noService.bookingId, 'доставка у вещи без объявленной услуги отклоняется', noService.err)

  await owner.from('items').update({ delivery_fee: 15, delivery_radius_km: 10 }).eq('id', itemId)

  const delivered = await ask({ item_id: itemId, start_date: day(6), end_date: day(7), delivery_requested: true })
  if (delivered.bookingId) {
    const { data: b } = await owner.from('bookings').select('delivery_requested, delivery_fee, total_price').eq('id', delivered.bookingId).single()
    check(b?.delivery_requested === true, 'выбор доставки записан в бронь')
    check(Number(b?.delivery_fee) === 15, 'цена доставки записана снимком ИЗ ВЕЩИ, а не из тела запроса', `получено ${b?.delivery_fee}`)
    // Две суммы живут раздельно: total_price — аренда по тарифам, доставка
    // считается отдельной строкой и деньгами платформы не является.
    check(Number(b?.total_price) === 20, 'доставка НЕ входит в total_price (2 дня × 10 €)', `получено ${b?.total_price}`)

    await owner.from('items').update({ delivery_fee: 99 }).eq('id', itemId)
    const { data: after } = await owner.from('bookings').select('delivery_fee').eq('id', delivered.bookingId).single()
    check(Number(after?.delivery_fee) === 15, 'правка цены у вещи не меняет условий уже созданной брони', `получено ${after?.delivery_fee}`)
    await owner.from('items').update({ delivery_fee: 15 }).eq('id', itemId)

    await owner.from('bookings').delete().eq('id', delivered.bookingId)
  } else {
    check(false, 'бронь с доставкой создалась', delivered.err)
  }

  // Не просили — снимка быть не должно. Инвариант базы это и держит:
  // delivery_requested = (delivery_fee IS NOT NULL).
  const noDelivery = await ask({ item_id: itemId, start_date: day(8), end_date: day(9) })
  if (noDelivery.bookingId) {
    const { data: b } = await owner.from('bookings').select('delivery_requested, delivery_fee').eq('id', noDelivery.bookingId).single()
    check(b?.delivery_requested === false && b?.delivery_fee === null, 'без просьбы о доставке бронь остаётся чистой', JSON.stringify(b))
    await owner.from('bookings').delete().eq('id', noDelivery.bookingId)
  } else {
    check(false, 'бронь без доставки создалась', noDelivery.err)
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

  // ── respond-to-request: двойное одобрение ───────────────────────────
  //
  // Единственная проверка, что вещь нельзя выдать дважды на одни даты. В
  // коде эту гарантию держат три разных механизма, и ни один из них не
  // виден статическим гейтам: повторная проверка занятости через
  // item_calendar, авто-отклонение ставших неисполнимыми заявок
  // (unservable_pending_requests) и условие по исходному статусу в самом
  // UPDATE. Если RPC занятости однажды откажет, checkRangeAvailable вернёт
  // null и одобрение пойдёт дальше — последним рубежом остаётся триггер
  // базы. Здесь проверяется ИТОГ, а не то, кто именно сработал.
  console.log('\nrespond-to-request: двойное одобрение')

  const first = await ask({ item_id: itemId, start_date: day(20), end_date: day(22) })
  const second = await ask({ item_id: itemId, start_date: day(20), end_date: day(22) })
  check(!!first.bookingId && !!second.bookingId,
    'две заявки на одни даты создаются (pending_approval вещь не держит)',
    `${first.err ?? ''} ${second.err ?? ''}`)

  if (first.bookingId && second.bookingId) {
    const approve = async (bookingId) => {
      const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/respond-to-request`, {
        method: 'POST',
        headers: {
          apikey: env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${(await owner.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking_id: bookingId, action: 'approve' }),
      })
      let json = {}
      try { json = await r.json() } catch { /* тело может быть пустым */ }
      return { status: r.status, json }
    }

    const ok1 = await approve(first.bookingId)
    check(ok1.status === 200, 'первое одобрение проходит', `HTTP ${ok1.status} ${JSON.stringify(ok1.json)}`)

    const ok2 = await approve(second.bookingId)
    // Два законных кода, и оба означают одно и то же для человека:
    //   dates_unavailable — календарь уже занят подтверждённой бронью;
    //   not_pending       — вторую заявку успело снять авто-отклонение
    //                       при первом одобрении (обычный случай).
    // Требовать конкретно dates_unavailable значило бы закрепить тестом
    // порядок срабатывания механизмов, а не саму гарантию.
    check(ok2.status === 409 && ['dates_unavailable', 'not_pending'].includes(ok2.json.error),
      'второе одобрение отклонено с 409', `HTTP ${ok2.status} ${JSON.stringify(ok2.json)}`)

    const { data: confirmed } = await owner.from('bookings')
      .select('id, status').eq('item_id', itemId).eq('status', 'confirmed')
    check((confirmed ?? []).length === 1,
      'в базе ровно одна подтверждённая бронь на эти даты', `строк ${(confirmed ?? []).length}`)

    const { data: both } = await owner.from('bookings')
      .select('id, status').in('id', [first.bookingId, second.bookingId])
    const statuses = (both ?? []).map(b => b.status).sort().join(',')
    check(statuses === 'confirmed,rejected',
      'вторая заявка закрыта, а не осталась висеть у человека как живая', `статусы: ${statuses}`)

    await owner.from('bookings').delete().in('id', [first.bookingId, second.bookingId])
  }

  // ── admin-action ────────────────────────────────────────────────────
  //
  // Единственная функция, которая пишет в ЧУЖИЕ строки служебным ключом,
  // то есть в обход RLS. Проверять её кодом нельзя по построению: вся
  // авторизация в ней написана руками, и «написано правильно» и
  // «развёрнуто и работает» — разные утверждения.
  console.log('\nadmin-action')

  const callAdmin = async (body, jwt) => {
    const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
    if (jwt) headers.Authorization = `Bearer ${jwt}`
    const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/admin-action`, {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    let json = {}
    try { json = await r.json() } catch { /* тело может быть пустым */ }
    return { status: r.status, json }
  }

  const targetUserId = (await renter.auth.getUser()).data.user.id

  // Эти две проверки не требуют админской учётки и потому идут всегда:
  // они об отказе, а отказывать функция обязана и без неё.
  const noJwt = await callAdmin({ type: 'set_item_available', item_id: itemId, available: false })
  check(noJwt.status === 401 && noJwt.json.error === 'unauthorized',
    'без авторизации → 401 unauthorized', `HTTP ${noJwt.status} ${noJwt.json.error}`)

  const renterJwt = (await renter.auth.getSession()).data.session.access_token
  const notAdmin = await callAdmin({ type: 'set_item_available', item_id: itemId, available: false }, renterJwt)
  check(notAdmin.status === 403 && notAdmin.json.error === 'forbidden',
    'обычный пользователь → 403 forbidden', `HTTP ${notAdmin.status} ${notAdmin.json.error}`)

  // Журнал закрыт для всех, кроме служебной роли, — и это проверяется под
  // ОБЫЧНЫМ пользователем, а не на веру по тексту миграции.
  const { data: logPeek, error: logErr } = await renter.from('admin_audit_log').select('id').limit(5)
  check((logPeek ?? []).length === 0,
    'admin_audit_log недоступен обычному пользователю', logErr ? logErr.code : `строк ${(logPeek ?? []).length}`)

  // Ради чего функция вообще существует: прямой путь из браузера закрыт.
  // Если этот check однажды провалится, значит кому-то расширили гранты, и
  // admin-action перестала быть единственной дверью.
  const { data: sneak } = await renter.from('users').update({ role: 'admin' }).eq('id', targetUserId).select('id')
  check((sneak ?? []).length === 0, 'смена роли прямым update из браузера не проходит', `строк ${(sneak ?? []).length}`)

  if (!hasAdmin) {
    skip('admin-action: действия администратора', 'в .env нет TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD')
  } else {
    const adminClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    const { error: eA } = await adminClient.auth.signInWithPassword({
      email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD,
    })
    if (eA) throw new Error(`вход админской учётки не удался: ${eA.message}`)

    const adminId = (await adminClient.auth.getUser()).data.user.id
    const adminJwt = (await adminClient.auth.getSession()).data.session.access_token

    // Сама учётка обязана быть админом — иначе весь раздел ниже проверял
    // бы не то, что думает, и все ответы 403 выглядели бы «по делу».
    const { data: adminRow } = await adminClient.from('users').select('role').eq('id', adminId).single()
    check(adminRow?.role === 'admin', 'TEST_ADMIN_* — учётка с ролью admin', `role=${adminRow?.role}`)

    const badBody = await callAdmin({ type: 'nope' }, adminJwt)
    check(badBody.status === 400 && badBody.json.error === 'bad_request',
      'неизвестное действие → 400 bad_request', `HTTP ${badBody.status} ${badBody.json.error}`)

    const badRole = await callAdmin({ type: 'set_user_role', user_id: targetUserId, role: 'superadmin' }, adminJwt)
    check(badRole.status === 400 && badRole.json.error === 'bad_request',
      'роль вне списка → 400 bad_request', `HTTP ${badRole.status} ${badRole.json.error}`)

    const self = await callAdmin({ type: 'set_user_role', user_id: adminId, role: 'user' }, adminJwt)
    check(self.status === 400 && self.json.error === 'cannot_demote_self',
      'снятие прав с себя → 400 cannot_demote_self', `HTTP ${self.status} ${self.json.error}`)
    const { data: stillAdmin } = await adminClient.from('users').select('role').eq('id', adminId).single()
    check(stillAdmin?.role === 'admin', 'после отказа админ остался админом', `role=${stillAdmin?.role}`)

    const ghostTarget = await callAdmin({
      type: 'set_item_available', item_id: '00000000-0000-4000-8000-000000000000', available: false,
    }, adminJwt)
    check(ghostTarget.status === 404 && ghostTarget.json.error === 'target_not_found',
      'несуществующая цель → 404 target_not_found', `HTTP ${ghostTarget.status} ${ghostTarget.json.error}`)

    // --- set_item_available: чужая вещь, владелец — другой человек ---
    const hide = await callAdmin({ type: 'set_item_available', item_id: itemId, available: false }, adminJwt)
    check(hide.status === 200 && hide.json.item?.available === false,
      'админ скрывает ЧУЖОЕ объявление', `HTTP ${hide.status} ${JSON.stringify(hide.json)}`)
    const { data: hidden } = await owner.from('items').select('available').eq('id', itemId).single()
    check(hidden?.available === false, 'скрытие видно в базе, а не только в ответе', `available=${hidden?.available}`)

    const show = await callAdmin({ type: 'set_item_available', item_id: itemId, available: true }, adminJwt)
    check(show.status === 200 && show.json.item?.available === true, 'админ возвращает объявление на витрину')

    // --- set_user_role: выдать и снять права ---
    const grant = await callAdmin({ type: 'set_user_role', user_id: targetUserId, role: 'admin' }, adminJwt)
    check(grant.status === 200 && grant.json.user?.role === 'admin',
      'админ выдаёт права другому', `HTTP ${grant.status} ${JSON.stringify(grant.json)}`)
    const { data: granted } = await renter.from('users').select('role').eq('id', targetUserId).single()
    check(granted?.role === 'admin', 'выдача прав видна в базе', `role=${granted?.role}`)

    const revoke = await callAdmin({ type: 'set_user_role', user_id: targetUserId, role: 'user' }, adminJwt)
    check(revoke.status === 200 && revoke.json.user?.role === 'user', 'админ снимает права')

    // --- get_stats: цифры площадки, а не свои собственные ---
    const stats = await callAdmin({ type: 'get_stats' }, adminJwt)
    check(stats.status === 200 && typeof stats.json.stats?.users === 'number',
      'get_stats отвечает счётчиками', `HTTP ${stats.status} ${JSON.stringify(stats.json)}`)
    // Под правами самого админа RLS показал бы ему только СВОИ брони.
    // Расхождение с общим числом и есть та ложь, ради которой действие
    // заведено; равенство допустимо лишь на пустой базе.
    const { count: ownBookings } = await adminClient.from('bookings').select('id', { count: 'exact', head: true })
    check((stats.json.stats?.bookings ?? -1) >= (ownBookings ?? 0),
      'счётчик броней не меньше «личного» — считает сервер, а не браузер',
      `сервер ${stats.json.stats?.bookings}, под правами админа ${ownBookings}`)
    check(!('revenue' in (stats.json.stats ?? {})),
      'в счётчиках нет выручки: платформа не берёт комиссию')

    const statsForRenter = await callAdmin({ type: 'get_stats' }, renterJwt)
    check(statsForRenter.status === 403, 'get_stats закрыт для не-админа', `HTTP ${statsForRenter.status}`)

    // --- Журнал: по строке на каждое ИЗМЕНЯЮЩЕЕ действие ---
    if (!service) {
      skip('admin_audit_log: содержимое записей', 'в окружении нет SUPABASE_SERVICE_ROLE_KEY')
    } else {
      const { data: roleLogs } = await service.from('admin_audit_log')
        .select('actor_id, action, target_table, payload')
        .eq('target_id', targetUserId).eq('action', 'set_user_role')
        .order('created_at', { ascending: false }).limit(2)
      check((roleLogs ?? []).length === 2, 'выдача и снятие прав записаны обе', `строк ${(roleLogs ?? []).length}`)
      check(roleLogs?.[0]?.actor_id === adminId, 'в журнале записан тот, кто действовал')
      check(roleLogs?.[0]?.target_table === 'users', 'таблица цели записана верно')
      check(roleLogs?.[0]?.payload?.role === 'user', 'в payload лежит разобранное действие целиком')

      const { data: itemLogs } = await service.from('admin_audit_log')
        .select('action').eq('target_id', itemId).eq('action', 'set_item_available')
      check((itemLogs ?? []).length === 2, 'оба действия над объявлением записаны', `строк ${(itemLogs ?? []).length}`)

      const { data: statsLogs } = await service.from('admin_audit_log')
        .select('id').eq('action', 'get_stats').limit(1)
      check((statsLogs ?? []).length === 0, 'чтение счётчиков в журнал НЕ пишется')

      // Уборка журнала: прогон не имеет права оставлять следы, иначе
      // счётчики выше в следующий раз посчитают чужие строки.
      await service.from('admin_audit_log').delete().eq('target_id', targetUserId)
      await service.from('admin_audit_log').delete().eq('target_id', itemId)
    }

    // Роль возвращается в исходное состояние в любом случае: если прогон
    // оборвётся выше, тестовый арендатор останется администратором.
    const { data: finalRole } = await renter.from('users').select('role').eq('id', targetUserId).single()
    if (finalRole?.role !== 'user') {
      await callAdmin({ type: 'set_user_role', user_id: targetUserId, role: 'user' }, adminJwt)
    }
    const { data: restored } = await renter.from('users').select('role').eq('id', targetUserId).single()
    check(restored?.role === 'user', 'тестовая учётка возвращена в роль user', `role=${restored?.role}`)

    await adminClient.auth.signOut()
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

  // Почта. По миграциям столбца email в public.users НЕТ ВОВСЕ (адреса
  // живут в auth.users, схема auth наружу не выставлена), но миграции в
  // этом проекте применяют руками — файл в репозитории ничего не
  // доказывает о живой базе. Проверяем поведением.
  //
  // Допустимых исходов ровно два: 42703 «столбца нет» и 42501 «прав нет».
  // УСПЕШНЫЙ запрос здесь означает утечку почты всех пользователей
  // площадки любому, кто открыл консоль браузера, — это P0, а не
  // замечание.
  for (const [client, who] of [[anon, 'аноним'], [renter, 'залогиненный']]) {
    const { data: mail, error: eMail } = await client.from('users').select('id, email').limit(1)
    check(eMail?.code === '42703' || eMail?.code === '42501',
      `${who} не читает email`,
      eMail ? eMail.code : `запрос ПРОШЁЛ, строк ${(mail ?? []).length} — УТЕЧКА`)
  }

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

console.log(`\nитог: ${passed} прошло, ${failed} провалено${skipped ? `, ${skipped} пропущено` : ''}`)
if (skipped) console.log('пропуск — это не «прошло»: см. TEST_ADMIN_* и SUPABASE_SERVICE_ROLE_KEY в README прогона')
process.exit(failed ? 1 : 0)
