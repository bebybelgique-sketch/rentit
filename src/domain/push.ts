// src/domain/push.ts
//
// НЕ КОПИЯ, А РЕЭКСПОРТ — как pricing.ts. Даты, имена и суммы в тексте
// уведомлений собирает сервер (supabase/functions/_shared/pushCopy.ts).
// Экран «Demande envoyée» показывает ТЕ ЖЕ «20 → 21 sept.» и «Ramzan B.»,
// что потом придут на экран блокировки: две реализации одного формата
// разошлись бы молча, и человек увидел бы одну и ту же заявку записанной
// двумя способами.

export { dateRange, shortName, money, isPushLang, renderPush } from '../../supabase/functions/_shared/pushCopy'
export type { PushLang, PushKind, PushFacts } from '../../supabase/functions/_shared/pushCopy'
export { b64urlDecode } from '../../supabase/functions/_shared/webPush'
