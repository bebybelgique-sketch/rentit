// supabase/functions/cleanup-orphan-photos/index.ts
//
// Убирает из приватного бакета файлы, у которых больше нет строки в
// booking_photos.
//
// Зачем отдельная функция, а не триггер в базе: Supabase запрещает
// удаление из storage.objects напрямую (storage.protect_delete), чистить
// можно только через Storage API. Значит SQL-каскад здесь невозможен в
// принципе, и уборка обязана жить в коде.
//
// Как возникают сироты. booking_photos.booking_id → bookings ON DELETE
// CASCADE, а storage.objects внешним ключом ни с чем не связан. Поэтому
// удаление вещи из кабинета, удаление учётной записи или снос брони
// уносят строку и оставляют файл. Замерено 11.08: 0 строк при 1 файле.
//
// Это не только мусор. Политика конфиденциальности обещает удаление
// данных, а условия — что фотографии видны только сторонам сделки.
// Снимок чужого инструмента в чужой квартире, переживший и бронь, и
// аккаунт, противоречит обоим обещаниям.
//
// Вызов: POST с заголовком X-Cleanup-Token, значение — секрет
// CLEANUP_TOKEN (задан через `supabase secrets set`). Пользовательский
// токен не подходит намеренно: функция ходит по всему бакету, это не
// операция одной стороны сделки.
//
// Почему отдельный секрет, а не сравнение с SUPABASE_SERVICE_ROLE_KEY:
// проект перешёл на ключи нового формата (sb_publishable_/sb_secret_), и
// значение переменной окружения перестало совпадать с тем, что выдаёт
// панель. Проверка, завязанная на формат ключей, ломается при их смене
// молча — отказом в доступе, который выглядит как поломка функции.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { json } from '../_shared/json.ts'

const supabase = createSupabaseServiceClient()
const BUCKET = 'booking-photos'
const PAGE = 100

// Файл считается сиротой не сразу: между загрузкой в бакет и вставкой
// строки в booking_photos проходит доля секунды, и уборка, запущенная
// ровно в этот момент, снесла бы фотографию у человека из-под рук.
//
// Окно вынесено в переменную окружения не ради гибкости, а ради
// проверяемости: с часовой выдержкой любой прогон на свежих данных даёт
// «удалено 0», и отличить работающий обход от молчащего невозможно.
const MIN_AGE_MS = Number(Deno.env.get('CLEANUP_MIN_AGE_MINUTES') ?? '60') * 60 * 1000

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  const expected = Deno.env.get('CLEANUP_TOKEN')
  const presented = req.headers.get('X-Cleanup-Token')
  if (!expected || !presented || presented !== expected) {
    return json({ error: 'Forbidden' }, 403)
  }

  try {
    const { data: rows, error: rowsErr } = await supabase
      .from('booking_photos')
      .select('storage_path')

    if (rowsErr) return json({ error: rowsErr.message }, 500)
    const known = new Set((rows || []).map((r) => r.storage_path as string))

    const orphans: string[] = []
    const now = Date.now()

    // Пути вида <booking_id>/<phase>/<файл>: обходим два уровня папок.
    const listFolders = async (prefix: string) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: PAGE })
      if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`)
      return data || []
    }

    for (const booking of await listFolders('')) {
      for (const phase of await listFolders(booking.name)) {
        for (const file of await listFolders(`${booking.name}/${phase.name}`)) {
          const path = `${booking.name}/${phase.name}/${file.name}`
          if (known.has(path)) continue

          const created = file.created_at ? Date.parse(file.created_at) : 0
          if (created && now - created < MIN_AGE_MS) continue

          orphans.push(path)
        }
      }
    }

    if (orphans.length === 0) {
      return json({ ok: true, checked: known.size, removed: 0 })
    }

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(orphans)
    if (rmErr) return json({ error: rmErr.message, found: orphans.length }, 500)

    return json({ ok: true, checked: known.size, removed: orphans.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
