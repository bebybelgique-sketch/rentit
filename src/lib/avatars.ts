// src/lib/avatars.ts
//
// НЕ КОПИЯ, А РЕЭКСПОРТ. Разбор имени аватара живёт в
// `supabase/functions/_shared/avatars.ts`, потому что тот же разбор нужен
// `delete-account` и уборке — а удаляет файлы сервер.
//
// Прежние такие пары в проекте (`itemPhotos`) писались двойниками с пометкой
// «правишь здесь — правь и там». 13.08 проверено, что реэкспорт через
// границу рантаймов проходит и `tsc`, и сборку Vite, — значит расходиться
// двум спискам расширений больше незачем.

export {
  AVATARS_BUCKET,
  AVATAR_EXTENSIONS,
  avatarObjectName,
  avatarPath,
  avatarExtension,
} from '../../supabase/functions/_shared/avatars'
export type { AvatarExtension } from '../../supabase/functions/_shared/avatars'
