// Сквозной прогон машины состояний брони на живом проекте.
// Три настоящие учётки, настоящие edge-функции, настоящая база.
//
// Адрес и ключ берутся из окружения или из .env — в файле их не держим:
// репозиторий публичный, а прибитый гвоздями адрес проекта делает тест
// непереносимым (ровно этим он и умер в прошлый раз, когда проект сменился).
//
// Уборка после прогона: supabase/tests/cleanup_test_accounts.sql
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const readEnvFile = () => {
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env')
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  } catch {
    return {}
  }
}

const env = { ...readEnvFile(), ...process.env }
const URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('Нужны VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY — в окружении или в .env')
  process.exit(1)
}

// Пароль одноразовый: учётки живут минуту и удаляются. Константы в коде
// публичного репозитория не место, даже когда она ничего не открывает.
const PASSWORD = 'T' + randomBytes(16).toString('base64url') + '!9'
const tag = 'sm-' + Date.now()

let pass = 0, fail = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK    ' : 'ПРОВАЛ'}  ${name}${extra ? '  — ' + extra : ''}`)
  ok ? pass++ : fail++
}

const api = async (path, opts = {}) => {
  const r = await fetch(URL + path, {
    ...opts,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: r.status, body }
}

const signup = async (who) => {
  const email = `${tag}-${who}@rentit-test.local`
  const r = await api('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!r.body.access_token) throw new Error(`signup ${who}: ${JSON.stringify(r.body)}`)
  return { id: r.body.user.id, token: r.body.access_token, email }
}

const fn = (name, token, payload) =>
  api(`/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

const iso = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return d.toISOString().slice(0, 10)
}

const main = async () => {
  const owner = await signup('owner')
  const renter = await signup('renter')
  const stranger = await signup('stranger')
  console.log(`учётки: owner=${owner.id} renter=${renter.id} stranger=${stranger.id}\n`)

  // Владелец публикует вещь
  const itemRes = await api('/rest/v1/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_id: owner.id, title: `${tag} perceuse`, category: 'power_tools',
      condition: 'good', price_per_day: 12, deposit: 0, photos: [], available: true,
    }),
  })
  if (itemRes.status !== 201) throw new Error('item: ' + JSON.stringify(itemRes.body))
  const itemId = itemRes.body[0].id
  console.log(`вещь: ${itemId}\n`)

  const request = async (from, to) => {
    const r = await fn('request-rental', renter.token, {
      item_id: itemId, start_date: iso(from), end_date: iso(to), message: 'bonjour',
    })
    if (![200, 201].includes(r.status)) throw new Error('request-rental: ' + JSON.stringify(r.body))
    const b = await api(
      `/rest/v1/bookings?item_id=eq.${itemId}&start_date=eq.${iso(from)}&select=id,status`,
      { headers: { Authorization: `Bearer ${renter.token}` } },
    )
    return b.body[0]
  }

  const statusOf = async (id) => {
    const r = await api(`/rest/v1/bookings?id=eq.${id}&select=status,cancelled_by,cancellation_reason`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    })
    return r.body[0]
  }

  // --- Ветка 1: арендатор отменяет заявку до одобрения ---
  const b1 = await request(10, 12)
  check('заявка создана в pending_approval', b1.status === 'pending_approval', b1.status)

  let r = await fn('transition-booking', stranger.token, { booking_id: b1.id, action: 'cancel' })
  check('посторонний не может отменить чужую бронь', r.status === 403, `HTTP ${r.status}`)

  r = await fn('transition-booking', owner.token, { booking_id: b1.id, action: 'cancel' })
  check('владелец не отменяет заявку до одобрения', r.status === 403, `HTTP ${r.status}`)

  r = await fn('transition-booking', owner.token, { booking_id: b1.id, action: 'complete' })
  check('нельзя завершить из pending_approval', r.status === 409, `HTTP ${r.status}`)

  r = await fn('transition-booking', renter.token, {
    booking_id: b1.id, action: 'cancel', reason: 'Plus besoin finalement',
  })
  check('арендатор отменяет заявку', r.status === 200, `HTTP ${r.status}`)
  const s1 = await statusOf(b1.id)
  check('статус стал cancelled', s1.status === 'cancelled', s1.status)
  check('записано, кто отменил', s1.cancelled_by === renter.id)
  check('записана причина', s1.cancellation_reason === 'Plus besoin finalement', String(s1.cancellation_reason))

  // --- Ветка 2: полный цикл до completed ---
  const b2 = await request(20, 22)
  r = await fn('respond-to-request', owner.token, { booking_id: b2.id, action: 'approve' })
  check('владелец одобряет заявку', r.status === 200, `HTTP ${r.status}`)
  check('статус стал confirmed', (await statusOf(b2.id)).status === 'confirmed')

  // Обход машины состояний: прямой PATCH из браузера. Пока это работало,
  // владелец мог сам себе поставить completed и открыть право на отзыв.
  const direct = await api(`/rest/v1/bookings?id=eq.${b2.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${owner.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'completed' }),
  })
  const stillConfirmed = (await statusOf(b2.id)).status === 'confirmed'
  check('прямая смена статуса из браузера отбита', direct.status >= 400 && stillConfirmed,
        `HTTP ${direct.status}, статус остался ${(await statusOf(b2.id)).status}`)

  // Витрина обязана скрывать занятое: иначе человек пишет владельцу про
  // инструмент, который на эти даты уже отдан, и получает отказ.
  const busyRpc = async (from, to) => {
    const res = await api('/rest/v1/rpc/items_busy_between', {
      method: 'POST',
      body: JSON.stringify({ p_start: iso(from), p_end: iso(to) }),
    })
    return (res.body || []).map((x) => x.item_id)
  }
  check('вещь числится занятой на даты подтверждённой брони',
        (await busyRpc(20, 22)).includes(itemId))
  check('на свободные даты вещь не числится занятой',
        !(await busyRpc(200, 201)).includes(itemId))

  r = await fn('transition-booking', renter.token, { booking_id: b2.id, action: 'handover' })
  check('арендатор не может объявить передачу', r.status === 403, `HTTP ${r.status}`)

  r = await fn('transition-booking', owner.token, { booking_id: b2.id, action: 'complete' })
  check('нельзя завершить из confirmed', r.status === 409, `HTTP ${r.status}`)

  r = await fn('transition-booking', owner.token, { booking_id: b2.id, action: 'handover' })
  check('владелец фиксирует передачу', r.status === 200, `HTTP ${r.status}`)
  check('статус стал active', (await statusOf(b2.id)).status === 'active')

  r = await fn('transition-booking', renter.token, { booking_id: b2.id, action: 'cancel' })
  check('из active отменить нельзя', r.status === 409, `HTTP ${r.status}`)

  r = await fn('transition-booking', owner.token, { booking_id: b2.id, action: 'complete' })
  check('владелец фиксирует возврат', r.status === 200, `HTTP ${r.status}`)
  check('статус стал completed', (await statusOf(b2.id)).status === 'completed')

  r = await fn('transition-booking', owner.token, { booking_id: b2.id, action: 'handover' })
  check('повторный переход из completed отклонён', r.status === 409, `HTTP ${r.status}`)

  // --- Ветка 3: владелец отменяет подтверждённую бронь ---
  const b3 = await request(40, 41)
  await fn('respond-to-request', owner.token, { booking_id: b3.id, action: 'approve' })
  r = await fn('transition-booking', owner.token, {
    booking_id: b3.id, action: 'cancel', reason: 'Outil en panne',
  })
  check('владелец отменяет подтверждённую бронь', r.status === 200, `HTTP ${r.status}`)
  const s3 = await statusOf(b3.id)
  check('отмена владельцем записана на него', s3.cancelled_by === owner.id)

  // --- Ветка 4: переписка и взаимные отзывы по завершённой броне ---
  const msg = await api('/rest/v1/booking_messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${renter.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({ booking_id: b2.id, sender_id: renter.id, body: 'Merci beaucoup !' }),
  })
  check('участник пишет в свою бронь', msg.status === 201, `HTTP ${msg.status}`)

  const msgStranger = await api('/rest/v1/booking_messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stranger.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({ booking_id: b2.id, sender_id: stranger.id, body: 'coucou' }),
  })
  check('посторонний не может писать в чужую бронь', msgStranger.status === 403, `HTTP ${msgStranger.status}`)

  const seen = await api(`/rest/v1/booking_messages?booking_id=eq.${b2.id}&select=id`, {
    headers: { Authorization: `Bearer ${stranger.token}` },
  })
  check('посторонний не видит переписки', Array.isArray(seen.body) && seen.body.length === 0,
        JSON.stringify(seen.body))

  const rev = await api('/rest/v1/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${renter.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({
      booking_id: b2.id, from_user_id: renter.id, to_user_id: owner.id,
      item_id: itemId, review_type: 'owner', rating: 5, comment: 'Super proprietaire',
    }),
  })
  check('арендатор оценивает владельца', rev.status === 201, `HTTP ${rev.status}`)

  const prof = await api(`/rest/v1/users?id=eq.${owner.id}&select=rating_as_owner`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  })
  check('рейтинг владельца пересчитан триггером',
        Number(prof.body[0]?.rating_as_owner) === 5, JSON.stringify(prof.body[0]))

  console.log(`\nИТОГ: ${pass} прошло, ${fail} провалено`)
  console.log(`МЕТКА ДЛЯ УБОРКИ: ${tag}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('СБОЙ ПРОГОНА:', e.message); process.exit(1) })
