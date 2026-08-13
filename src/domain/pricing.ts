// src/domain/pricing.ts
//
// НЕ КОПИЯ, А РЕЭКСПОРТ. Расчёт живёт в
// `supabase/functions/_shared/pricing.ts`, потому что сумму в бронь пишет
// сервер, и он — владелец правды о цене. Клиент показывает ту же цифру до
// нажатия кнопки.
//
// Две реализации одной формулы разошлись бы молча: человек увидел бы одну
// сумму, а в брони оказалась бы другая. Здесь разойтись нечему — файл один.

export { computeRentalPrice } from '../../supabase/functions/_shared/pricing'
export type { RentalRates, PriceBreakdown } from '../../supabase/functions/_shared/pricing'
