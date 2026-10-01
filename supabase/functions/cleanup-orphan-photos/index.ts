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
import { AVATARS_BUCKET, avatarPath } from '../_shared/avatars.ts'
import { fetchAllRows, listAllEntries, planSweep } from '../_shared/sweep.ts'

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
    return json({ error: 'forbidden' }, 403)
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
        // Папка целиком, страницами: без offset `list` отдавал всегда одну и
        // ту же первую сотню, и сироты дальше неё не находились никогда.
        list: (prefix) => listAllEntries(async (offset, limit) => {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } })
          if (error) throw new Error(`list ${bucket}:${prefix || '/'}: ${error.message}`)
          return data || []
        }, PAGE),
      })

      if (plan.orphans.length === 0) {
        return { checked: plan.checked, scanned: plan.scanned, removed: 0 }
      }

      const { error: rmErr } = await supabase.storage.from(bucket).remove(plan.orphans)
      if (rmErr) throw new Error(`remove ${bucket}: ${rmErr.message} (найдено ${plan.orphans.length})`)

      return { checked: plan.checked, scanned: plan.scanned, removed: plan.orphans.length }
    }

    // Ссылки из базы — ВСЕ строки, страницами и со сверкой счёта
    // (fetchAllRows). Один select резался бы лимитом Max rows, и всё, что
    // в него не влезло, ушло бы в сироты — то есть под удаление. Неполная
    // выборка бросает, и уборка не удаляет ничего (ответ — 500 с причиной).

    // --- booking-photos: удерживает строка в booking_photos ---
    // Код — в error, причина — в detail: ответ читает журнал cron, и
    // причина ему нужна, но договор «error — это код» един для всех функций.
    const photoRows = await fetchAllRows<{ storage_path: string }>((from, to) =>
      supabase.from('booking_photos').select('storage_path', { count: 'exact' }).order('id').range(from, to))

    // Пути `<booking_id>/<phase>/<файл>`: от пустого корня два уровня папок.
    const bookings = await sweep(
      BOOKING_BUCKET,
      new Set(photoRows.map((r) => r.storage_path)),
      '',
      2,
    )

    // --- item-photos: удерживает ссылка в items.photos ---
    //
    // Адрес → путь считает `itemPhotoPaths`. Ошибка в разборе здесь опаснее
    // молчания: неузнанный путь выглядит сиротой, и уборка снесла бы живой
    // снимок с витрины. Поэтому разбор вынесен в отдельный модуль и покрыт
    // тестами на стороне браузера (`src/lib/__tests__/itemPhotos.test.ts`).
    const itemRows = await fetchAllRows<{ photos?: unknown }>((from, to) =>
      supabase.from('items').select('photos', { count: 'exact' }).order('id').range(from, to))

    // Пути `items/<uid>/<файл>`: первый сегмент фиксирован, значит от корня
    // `items` остаётся ОДИН уровень папок, а не два.
    const items = await sweep(
      ITEM_PHOTOS_BUCKET,
      new Set(itemRows.flatMap((i) => itemPhotoPaths(i.photos))),
      'items',
      1,
    )

    // --- avatars: удерживает ссылка в users.avatar_url ---
    //
    // Сирота заводится при смене расширения: `<uid>.png` не перезаписывает
    // `<uid>.jpg`, это разные объекты. Загрузка убирает прежний сама, но
    // право на удаление у неё появилось только 13.08 — файлы, накопленные
    // до этого, подбирать некому, кроме уборки.
    //
    // Внешние адреса (аватар из OAuth, ссылка, вставленная руками, пока поле
    // было текстовым) `avatarPath` отбрасывает: они не в нашем бакете, и
    // держать по ним нечего.
    const userRows = await fetchAllRows<{ avatar_url?: unknown }>((from, to) =>
      supabase.from('users').select('avatar_url', { count: 'exact' }).order('id').range(from, to))

    // Пути `<uid>.<расширение>` лежат в корне бакета: папок между корнем и
    // файлами нет вовсе.
    const avatars = await sweep(
      AVATARS_BUCKET,
      new Set(
        userRows
          .map((u) => avatarPath(u.avatar_url))
          .filter((p): p is string => p !== null),
      ),
      '',
      0,
    )

    return json({
      ok: true,
      'booking-photos': bookings,
      'item-photos': items,
      avatars,
      removed: bookings.removed + items.removed + avatars.removed,
    })
  } catch (err) {
    return json({ error: 'internal_error', detail: err instanceof Error ? err.message : String(err) }, 500)
  }
})
