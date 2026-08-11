// Проверка приватного бакета booking-photos на живом проекте.
//
// Это единственная часть машины, которую нельзя проверить SQL-ом: политики
// на storage.objects разбирают ПУТЬ файла, и ошибка в разборе даёт либо
// дыру (чужой видит фото чужой квартиры), либо мёртвую кнопку.
//
// Уборка: supabase/tests/cleanup_test_accounts.sql
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const readEnvFile = () => {
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');
    return Object.fromEntries(
      readFileSync(path, 'utf8').split('\n').map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch { return {}; }
};

const env = { ...readEnvFile(), ...process.env };
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Нужны VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const PASSWORD = 'T' + randomBytes(16).toString('base64url') + '!9';
const tag = 'ph-' + Date.now();

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'OK    ' : 'ПРОВАЛ'}  ${name}${extra ? '  — ' + extra : ''}`);
  ok ? pass++ : fail++;
};

const api = async (path, opts = {}) => {
  const r = await fetch(URL + path, {
    ...opts, headers: { apikey: KEY, ...(opts.headers || {}) },
  });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
};

const jsonApi = (path, opts = {}) =>
  api(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });

const signup = async (who) => {
  const r = await jsonApi('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email: `${tag}-${who}@rentit-test.local`, password: PASSWORD }),
  });
  if (!r.body.access_token) throw new Error(`signup ${who}: ${JSON.stringify(r.body)}`);
  return { id: r.body.user.id, token: r.body.access_token };
};

// Настоящий однопиксельный PNG: бакет ограничен по типу содержимого,
// произвольные байты он отклонит и проверка окажется ни о чём.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

const main = async () => {
  const owner = await signup('owner');
  const renter = await signup('renter');
  const stranger = await signup('stranger');

  const item = await jsonApi('/rest/v1/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_id: owner.id, title: `${tag} scie`, category: 'power_tools', condition: 'good',
      price_per_day: 10, deposit: 0, photos: [], available: true,
    }),
  });
  const itemId = item.body[0].id;

  await jsonApi('/functions/v1/request-rental', {
    method: 'POST',
    headers: { Authorization: `Bearer ${renter.token}` },
    body: JSON.stringify({ item_id: itemId, start_date: iso(5), end_date: iso(6), message: 'ok' }),
  });
  const bk = await api(`/rest/v1/bookings?item_id=eq.${itemId}&select=id`, {
    headers: { Authorization: `Bearer ${renter.token}` },
  });
  const bookingId = bk.body[0].id;

  const upload = (token, path) => api(`/storage/v1/object/booking-photos/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
    body: PNG,
  });

  // --- Участник кладёт фото по правильному пути ---
  const good = `${bookingId}/handover/a.png`;
  let r = await upload(owner.token, good);
  check('владелец загружает фото своей брони', r.status === 200, `HTTP ${r.status}`);

  // --- Посторонний не может положить файл в чужую бронь ---
  r = await upload(stranger.token, `${bookingId}/handover/intrus.png`);
  check('посторонний не может загрузить в чужую бронь', r.status >= 400, `HTTP ${r.status}`);

  // --- Путь не по формату: первый сегмент не UUID ---
  r = await upload(owner.token, `pas-un-uuid/handover/x.png`);
  check('путь без идентификатора брони отклонён', r.status >= 400, `HTTP ${r.status}`);

  // --- Чужая бронь по чужому UUID ---
  r = await upload(stranger.token, `00000000-0000-0000-0000-000000000000/handover/x.png`);
  check('несуществующая бронь отклонена', r.status >= 400, `HTTP ${r.status}`);

  // --- Запись в таблицу и подписанная ссылка ---
  const row = await jsonApi('/rest/v1/booking_photos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}`, Prefer: 'return=representation' },
    body: JSON.stringify({
      booking_id: bookingId, uploaded_by: owner.id, phase: 'handover', storage_path: good,
    }),
  });
  check('строка о фото создана', row.status === 201, `HTTP ${row.status}`);

  const sign = (token) => jsonApi(`/storage/v1/object/sign/booking-photos/${good}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ expiresIn: 60 }),
  });

  const signedOwner = await sign(owner.token);
  check('владелец получает подписанную ссылку', signedOwner.status === 200, `HTTP ${signedOwner.status}`);

  const signedRenter = await sign(renter.token);
  check('арендатор получает подписанную ссылку', signedRenter.status === 200, `HTTP ${signedRenter.status}`);

  const signedStranger = await sign(stranger.token);
  check('посторонний не получает ссылку на чужое фото',
        signedStranger.status >= 400, `HTTP ${signedStranger.status}`);

  // --- Бакет действительно приватный ---
  const direct = await fetch(`${URL}/storage/v1/object/public/booking-photos/${good}`);
  check('прямая публичная ссылка не работает', direct.status >= 400, `HTTP ${direct.status}`);

  // --- Подписанная ссылка действительно отдаёт файл ---
  if (signedOwner.status === 200) {
    const signedUrl = URL + '/storage/v1' + signedOwner.body.signedURL;
    const fetched = await fetch(signedUrl);
    const buf = Buffer.from(await fetched.arrayBuffer());
    check('по подписанной ссылке приходит тот же файл',
          fetched.status === 200 && buf.equals(PNG), `HTTP ${fetched.status}, ${buf.length} байт`);
  }

  // --- Посторонний не видит строк о фото ---
  const seen = await api(`/rest/v1/booking_photos?booking_id=eq.${bookingId}&select=id`, {
    headers: { Authorization: `Bearer ${stranger.token}` },
  });
  check('посторонний не видит записей о фото',
        Array.isArray(seen.body) && seen.body.length === 0, JSON.stringify(seen.body));

  console.log(`\nИТОГ: ${pass} прошло, ${fail} провалено`);
  console.log(`МЕТКА ДЛЯ УБОРКИ: ${tag}`);
  if (fail > 0) process.exit(1);
};

main().catch((e) => { console.error('СБОЙ ПРОГОНА:', e.message); process.exit(1); });
