// src/lib/itemPhotos.ts
//
// В таблице `items` снимки хранятся ПУБЛИЧНЫМИ АДРЕСАМИ, а Storage API
// удаляет по пути внутри бакета. Пока этой пары не было, удалить снимок было
// физически не по чему: объявление сносили, файл оставался в публичном
// бакете навсегда и открывался по прямой ссылке.
//
// Тот же разбор нужен и на сервере (`delete-account`, `cleanup-orphan-photos`),
// но там Deno и свой рантайм — копия лежит в
// `supabase/functions/_shared/item-photos.ts`. Правишь здесь — правь и там.

export const ITEM_PHOTOS_BUCKET = 'item-photos';

const MARKER = `/${ITEM_PHOTOS_BUCKET}/`;

/**
 * Из публичного адреса снимка достаёт путь внутри бакета.
 *
 * `https://…/storage/v1/object/public/item-photos/items/<uid>/<файл>`
 *   → `items/<uid>/<файл>`
 *
 * Возвращает `null` на всём, что не является адресом нашего бакета:
 * в `items.photos` могли осесть внешние ссылки от прежних посевов, и
 * удалять по ним нечего.
 */
export function itemPhotoPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const at = url.indexOf(MARKER);
  if (at === -1) return null;
  const path = url.slice(at + MARKER.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

/** То же для списка: внешние ссылки и пустые значения отбрасываются. */
export function itemPhotoPaths(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const paths: string[] = [];
  for (const url of urls) {
    const path = itemPhotoPath(typeof url === 'string' ? url : null);
    if (path) paths.push(path);
  }
  return paths;
}
