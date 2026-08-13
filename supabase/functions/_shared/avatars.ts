// supabase/functions/_shared/avatars.ts
//
// Аватар: имя файла в бакете и разбор публичного адреса.
//
// ПОЧЕМУ ИМЯ ФАЙЛА ИМЕННО `<uid>.<расширение>`. Так требуют политики
// хранилища, заведённые вместе с бакетом:
//   INSERT/UPDATE: auth.uid()::text = split_part(name, '.', 1)
// Любой другой путь человек записать не сможет — получит отказ, который в
// интерфейсе выглядит как «загрузка не работает».
//
// ПОЧЕМУ РАСШИРЕНИЙ РОВНО ЧЕТЫРЕ. `delete-account` удаляет аватар перебором
// `<uid>.jpg|jpeg|png|webp`. Разреши мы пятое — файл пережил бы удаление
// учётной записи и остался в ПУБЛИЧНОМ бакете: фотография лица человека,
// который попросил себя стереть. Список общий, чтобы эти два места не могли
// разойтись.
//
// Файл общий для браузера и Deno: `src/lib/avatars.ts` — реэкспорт отсюда,
// а не копия. Прежние такие пары (`item-photos`) писались двойниками с
// пометкой «правишь здесь — правь и там»; 13.08 проверено, что реэкспорт
// через границу проходит и `tsc`, и сборку (см. `_shared/pricing.ts`).

export const AVATARS_BUCKET = 'avatars'

/** Расширения, которые умеет удалять `delete-account`. Больше не добавлять. */
export const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
export type AvatarExtension = (typeof AVATAR_EXTENSIONS)[number]

const MARKER = `/${AVATARS_BUCKET}/`

/** Имя объекта в бакете для этого человека. */
export function avatarObjectName(userId: string, ext: AvatarExtension): string {
  return `${userId}.${ext}`
}

/**
 * Из публичного адреса достаёт имя объекта внутри бакета.
 *
 * `https://…/object/public/avatars/<uid>.jpg` → `<uid>.jpg`
 *
 * `null` на всём остальном: в `users.avatar_url` лежат и внешние ссылки —
 * аватары из OAuth и адреса, вставленные руками, пока поле было текстовым.
 * Удалять по ним нечего, и трогать их нельзя.
 */
export function avatarPath(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null
  const at = url.indexOf(MARKER)
  if (at === -1) return null
  const name = url.slice(at + MARKER.length).split('?')[0]
  return name ? decodeURIComponent(name) : null
}

/**
 * Расширение файла, пригодное для аватара, или `null`.
 *
 * Смотрим на ИМЯ файла, а не на MIME: браузер отдаёт `image/jpeg` и для
 * `.jpg`, и для `.jpeg`, а нам нужно точное имя объекта — по нему потом
 * удаляет `delete-account`.
 */
export function avatarExtension(fileName: string): AvatarExtension | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return AVATAR_EXTENSIONS.includes(ext as AvatarExtension) ? (ext as AvatarExtension) : null
}
