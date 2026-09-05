import { describe, it, expect } from 'vitest';
import fr from '../../locales/fr.json';
import en from '../../locales/en.json';
import nl from '../../locales/nl.json';
import { SERVER_ERROR_KEYS, GENERIC_ERROR_KEY, serverErrorKey } from '../serverErrors';

// Слепая зона стража словарей, закрытая здесь.
//
// scripts/check-i18n-keys.mjs находит только литеральные t('...'). Ключи
// отказов сервера подставляются переменной — для него их не существует
// вовсе. Без этого файла первый же код без перевода показал бы человеку
// «serverErrors.dates_unavailable» на экране, и ни один гейт не возразил бы.

const LANGS = ['fr', 'en', 'nl'] as const;

const dicts: Record<(typeof LANGS)[number], Record<string, unknown>> = { fr, en, nl };

const lookup = (dict: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, dict);

describe('коды отказов сервера', () => {
  it.each(LANGS)('каждый код переведён на %s', (lang) => {
    const missing = [...new Set(Object.values(SERVER_ERROR_KEYS))]
      .filter((key) => typeof lookup(dicts[lang], key) !== 'string');
    expect(missing).toEqual([]);
  });

  it.each(LANGS)('запасной ключ есть в %s', (lang) => {
    expect(typeof lookup(dicts[lang], GENERIC_ERROR_KEY)).toBe('string');
  });

  it('неизвестный код не показывает человеку своё имя', () => {
    // Функция, добавленная завтра, вернёт код, о котором интерфейс не
    // знает. Показать его как есть — то же самое, что показать
    // «Edge Function returned a non-2xx status code», от чего мы и уходили.
    expect(serverErrorKey('some_new_code_from_the_future')).toBe(GENERIC_ERROR_KEY);
    expect(serverErrorKey(undefined)).toBe(GENERIC_ERROR_KEY);
    expect(serverErrorKey('')).toBe(GENERIC_ERROR_KEY);
  });

  it('известный код ведёт в свою строку', () => {
    expect(serverErrorKey('cannot_demote_self')).toBe('serverErrors.cannot_demote_self');
    expect(serverErrorKey('dates_unavailable')).toBe('serverErrors.dates_unavailable');
  });
});
