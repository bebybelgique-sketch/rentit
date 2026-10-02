import { describe, it, expect } from 'vitest';
import { formatDay, formatMoment, formatNumber, localeOf, parseDay } from '../dates';

describe('даты на языке читателя, по-бельгийски', () => {
  it('язык интерфейса → бельгийская локаль; неизвестный — французский', () => {
    expect(localeOf('fr')).toBe('fr-BE');
    expect(localeOf('nl-BE')).toBe('nl-BE');
    expect(localeOf('en-US')).toBe('en-GB');
    expect(localeOf('de')).toBe('fr-BE');
    expect(localeOf(undefined)).toBe('fr-BE');
  });

  // Главное: у голландца — нидерландский месяц, у англичанина — день перед
  // месяцем. До 02.10 «Mes locations» писала «15 août» всем.
  it('месяц — на языке читателя', () => {
    expect(formatDay('2026-08-15', 'fr')).toMatch(/août/);
    expect(formatDay('2026-10-02', 'nl')).toMatch(/okt/);
    expect(formatDay('2026-10-02', 'en')).toMatch(/Oct/);
  });

  // 'en' без страны Intl понимает как США: «10/2/2026» читалось бы как
  // 10 февраля. en-GB ставит день первым.
  it('цифровая дата по-английски — день перед месяцем', () => {
    expect(formatDay('2026-10-02', 'en', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('02/10/2026');
  });

  // 'YYYY-MM-DD' — день, а не момент: полночь UTC съехала бы на вчера
  // западнее Гринвича.
  it('день читается как местная полночь, а не UTC', () => {
    const d = parseDay('2026-10-02')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 2]);
  });

  it('неразборчивое не превращается в «Invalid Date»', () => {
    expect(formatDay('pas une date', 'fr')).toBe('pas une date');
    expect(formatDay(null, 'fr')).toBe('');
    expect(formatMoment('???', 'fr')).toBe('');
  });

  it('числа — с запятой во французском и нидерландском, с точкой в английском', () => {
    expect(formatNumber(4.5, 'fr', { minimumFractionDigits: 1 })).toBe('4,5');
    expect(formatNumber(4.5, 'nl', { minimumFractionDigits: 1 })).toBe('4,5');
    expect(formatNumber(4.5, 'en', { minimumFractionDigits: 1 })).toBe('4.5');
  });
});
