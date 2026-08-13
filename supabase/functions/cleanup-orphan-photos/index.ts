// supabase/functions/cleanup-orphan-photos/index.ts
//
// Убирает из обоих фото-бакетов файлы, которые больше ничем не удерживаются:
// из приватного `booking-photos` — те, у кого нет строки в `booking_photos`,
// из ПУБЛИЧНОГО `item-photos` — те, на кого не ссылается ни одно объявление.
//
// Второй бакет добавлен 13.08. До этого снимки объявлений не удалялись
// НИКОГДА и ниоткуда: ни при снятии объявления, ни при удалении аккаунта.
// Бакет публичный, то есть снятое объявление оставляло снимок чужой вещи в
// чужой квартире доступным по прямой ссылке бессрочно — при том что
// политика конфиденциальности на всех трёх языках обещает «Photos: deleted
// within 30 days of listing removal».
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
import { ITEM_PHOTOS_BUCKET, itemPhotoPaths } from '../_shared/item-photos.ts'
import { planSweep } from '../_shared/sweep.ts'

const supabase = createSupabaseServiceClient()
const BOOKING_BUCKET = 'booking-photos'
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
    // Обход и решение «сирота или нет» живут в `_shared/sweep.ts` и покрыты
    // тестами. Здесь остаются только сеть и удаление.
    const sweep = async (bucket: string, known: Set<string>, root: string, depth: number) => {
      const plan = await planSweep({
        known,
        root,
        depth,
        minAgeMs: MIN_AGE_MS,
        list: async (prefix) => {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(prefix, { limit: PAGE })
          if (error) throw new Error(`list ${bucket}:${prefix || '/'}: ${error.message}`)
          return data || []
        },
      })

      if (plan.orphans.length === 0) {
        return { checked: plan.checked, scanned: plan.scanned, removed: 0 }
      }

      const { error: rmErr } = await supabase.storage.from(bucket).remove(plan.orphans)
      if (rmErr) throw new Error(`remove ${bucket}: ${rmErr.message} (найдено ${plan.orphans.length})`)

      return { checked: plan.checked, scanned: plan.scanned, removed: plan.orphans.length }
    }

    // --- booking-photos: удерживает строка в booking_photos ---
    const { data: photoRows, error: photoErr } = await supabase
      .from('booking_photos')
      .select('storage_path')
    if (photoErr) return json({ error: photoErr.message }, 500)

    // Пути `<booking_id>/<phase>/<файл>`: от пустого корня два уровня папок.
    const bookings = await sweep(
      BOOKING_BUCKET,
      new Set((photoRows || []).map((r) => r.storage_path as string)),
      '',
      2,
    )

    // --- item-photos: удерживает ссылка в items.photos ---
    //
    // Адрес → путь считает `itemPhotoPaths`. Ошибка в разборе здесь опаснее
    // молчания: неузнанный путь выглядит сиротой, и уборка снесла бы живой
    // снимок с витрины. Поэтому разбор вынесен в отдельный модуль и покрыт
    // тестами на стороне браузера (`src/lib/__tests__/itemPhotos.test.ts`).
    const { data: itemRows, error: itemErr } = await supabase
      .from('items')
      .select('photos')
    if (itemErr) return json({ error: itemErr.message }, 500)

    // Пути `items/<uid>/<файл>`: первый сегмент фиксирован, значит от корня
    // `items` остаётся ОДИН уровень папок, а не два.
    const items = await sweep(
      ITEM_PHOTOS_BUCKET,
      new Set((itemRows || []).flatMap((i: { photos?: unknown }) => itemPhotoPaths(i.photos))),
      'items',
      1,
    )

    return json({
      ok: true,
      'booking-photos': bookings,
      'item-photos': items,
      removed: bookings.removed + items.removed,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
