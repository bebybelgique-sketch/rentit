// src/domain/dates.ts
//
// Даты и числа — на языке читателя, по бельгийским правилам.
//
// ЗАЧЕМ ОДНО МЕСТО. До 02.10 экраны решали сами, и решали по-разному:
// «Mes locations» и переписка — жёстко 'fr-BE' («Van 15 août 2026 tot…» у
// голландца), дата отзыва — по языку ТЕЛЕФОНА (`toLocaleDateString()` без
// аргумента), подсказка о сроке — по `i18n.language`, то есть для 'en' —
// по-американски «10/2/2026» вместо 2 октября, а на трёх экранах стоял сырой
// ISO «2026-10-15». Правило «по языку читателя, по-бельгийски» теперь живёт
// здесь, и сторож src/__tests__/datesReaderLanguage.test.ts не даёт экрану
// снова решить самому.
//
// ПОЧЕМУ en-GB, А НЕ en. Голое 'en' Intl понимает как США: «10/2/2026»
// читалось бы как 10 февраля. en-GB ставит день первым, как fr-BE и nl-BE,
// и пишет десятичную точку. en-BE тоже ставит день первым, но по CLDR пишет
// десятичную ЗАПЯТУЮ — английскому читателю это «4,5» вместо «4.5».

const LOCALE: Record<string, string> = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' };

/** Язык интерфейса ('fr', 'nl-BE', 'en-US'…) → локаль с днём перед месяцем. */
export const localeOf = (lang: string | null | undefined): string =>
  LOCALE[(lang ?? '').slice(0, 2).toLowerCase()] ?? 'fr-BE';

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 'YYYY-MM-DD' — это день, а не момент: читается как МЕСТНАЯ полночь.
 * `new Date('2026-10-02')` дал бы полночь UTC, и западнее Гринвича день
 * съехал бы на вчерашний. Метка времени с часами читается как есть.
 */
export function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = DAY_ONLY.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DEFAULT_DAY: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

/** «02 oct. 2026» / «02 okt 2026» / «02 Oct 2026». Неразборчивое — как пришло. */
export function formatDay(
  iso: string | null | undefined,
  lang: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DAY,
): string {
  const d = parseDay(iso);
  if (!d) return iso ?? '';
  return new Intl.DateTimeFormat(localeOf(lang), options).format(d);
}

const DEFAULT_MOMENT: Intl.DateTimeFormatOptions = {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
};

/** Момент с часами: время сообщения, отмены. Неразборчивое — пустая строка. */
export function formatMoment(
  iso: string | null | undefined,
  lang: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_MOMENT,
): string {
  const d = parseDay(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(localeOf(lang), options).format(d);
}

/** Число с запятой или точкой — как принято у читателя. */
export function formatNumber(n: number, lang: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeOf(lang), options).format(n);
}
