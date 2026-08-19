// Убирает объявления, оставленные сквозными проверками.
//
// Оснастка удаляет свою вещь в afterEach, но afterEach не спасает, когда
// прогон падает ПОСЛЕ создания вещи или обрывается на полуслове: 11.08 шесть
// таких вещей доехали до живой витрины. Витрина пуста намеренно — мусор на
// ней это не «мелочь в тестовой базе», а неверная витрина.
//
// Удаляет строго: только владельца из TEST_OWNER_EMAIL и только заголовки,
// начинающиеся с «E2E ». Чужого не трогает.
//
//   node scripts/cleanup-e2e-items.mjs          — показать, что будет удалено
//   node scripts/cleanup-e2e-items.mjs --apply  — удалить
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const PREFIX = 'E2E '

// .env читаем, ЕСЛИ он есть. На CI его нет — переменные приходят из
// окружения, и без этого try скрипт падал бы на чтении файла ещё до первой
// строчки работы. Шаг уборки обёрнут в `|| true`, поэтому падение было бы
// МОЛЧАЛИВЫМ: уборка не выполнялась бы вовсе, и никто бы не узнал.
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  }
} catch {
  // Файла нет — это нормально: дальше проверяются сами переменные.
}

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD } = process.env
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY || !TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
  console.error('Нужны VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEST_OWNER_EMAIL, TEST_OWNER_PASSWORD в .env')
  process.exit(1)
}

const apply = process.argv.includes('--apply')
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: TEST_OWNER_EMAIL,
  password: TEST_OWNER_PASSWORD,
})
if (authError) {
  console.error(`Вход не удался: ${authError.message}`)
  process.exit(1)
}

const { data: items, error: selectError } = await supabase
  .from('items')
  .select('id, title, created_at')
  .eq('owner_id', auth.user.id)
  .like('title', `${PREFIX}%`)
  .order('created_at', { ascending: false })

if (selectError) {
  console.error(`Не удалось прочитать список: ${selectError.message}`)
  process.exit(1)
}

if (!items.length) {
  console.log('Мусора нет: объявлений с заголовком «E2E …» у тестового владельца не найдено.')
  process.exit(0)
}

console.log(`Найдено ${items.length}:`)
for (const item of items) console.log(`  ${item.created_at.slice(0, 19)}  ${item.title}  (${item.id})`)

if (!apply) {
  console.log('\nЭто список, а не удаление. Повторите с --apply, чтобы удалить.')
  process.exit(0)
}

const { error: deleteError } = await supabase
  .from('items')
  .delete()
  .in('id', items.map(i => i.id))

if (deleteError) {
  console.error(`Удаление не прошло: ${deleteError.message}`)
  process.exit(1)
}

const { count } = await supabase
  .from('items')
  .select('id', { count: 'exact', head: true })
  .eq('owner_id', auth.user.id)
  .like('title', `${PREFIX}%`)

console.log(`\nУдалено ${items.length}. Осталось с таким заголовком: ${count ?? 'неизвестно'}.`)
