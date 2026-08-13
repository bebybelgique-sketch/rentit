// supabase/functions/_shared/item-photos.ts
//
// В таблице `items` снимки хранятся ПУБЛИЧНЫМИ АДРЕСАМИ, а Storage API
// удаляет по пути внутри бакета. Без этой пары удалить снимок объявления
// физически не по чему.
//
// Копия того же разбора для браузера лежит в `src/lib/itemPhotos.ts`:
// рантаймы разные, общий модуль между ними не протянуть. Правишь здесь —
// правь и там.

export const ITEM_PHOTOS_BUCKET = 'item-photos'

const MARKER = `/${ITEM_PHOTOS_BUCKET}/`

/**
 * `https://…/object/public/item-photos/items/<uid>/<файл>` → `items/<uid>/<файл>`
 *
 * `null` на всём, что не адрес нашего бакета: в `items.photos` могли осесть
 * внешние ссылки от прежних посевов, удалять по ним нечего.
 */
export function itemPhotoPath(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null
  const at = url.indexOf(MARKER)
  if (at === -1) return null
  const path = url.slice(at + MARKER.length).split('?')[0]
  return path ? decodeURIComponent(path) : null
}

/** То же для массива: внешние ссылки и мусор отбрасываются. */
export function itemPhotoPaths(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  const paths: string[] = []
  for (const url of urls) {
    const path = itemPhotoPath(url)
    if (path) paths.push(path)
  }
  return paths
}
