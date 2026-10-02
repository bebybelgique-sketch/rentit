import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Даты и числа на экранах форматирует ОДНО место — src/domain/dates.ts.
//
// До 02.10 каждый экран решал сам: «Mes locations» и переписка — жёстко
// 'fr-BE' (голландец читал «Van 15 août 2026 tot…»), дата отзыва — по
// языку телефона (`toLocaleDateString()` без аргумента), подсказка о сроке —
// по голому 'en', то есть по-американски «10/2/2026». Набор тестов поднимает
// i18next только на французском, поэтому ни одна проверка этого не видела.
//
// Этот сторож не даёт экрану снова решить самому.

const ROOT = join(__dirname, '..');

/**
 * Где прямой Intl законен — и почему. Список намеренно короткий.
 */
const EXEMPT = new Map<string, string>([
  ['domain/dates.ts', 'то самое одно место'],
  ['domain/availability.ts', 'названия дней недели календаря — по языку читателя, причина записана в weekdayLabels'],
  ['pages/Admin.tsx', 'служебная страница, не для людей площадки'],
  ['components/admin/AdminErrors.tsx', 'служебная вкладка администратора'],
]);

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: 'toLocale…String()', re: /\.toLocale(Date|Time)?String\(/ },
  { name: 'new Intl.DateTimeFormat/NumberFormat', re: /new Intl\.(DateTimeFormat|NumberFormat)\(/ },
  { name: 'зашитая локаль', re: /['"`][a-z]{2}-[A-Z]{2}['"`]/ },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'test' || name === 'locales') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('даты и числа — через src/domain/dates.ts', () => {
  const files = walk(ROOT);

  it('обход видит код', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('экраны не форматируют даты и числа сами и не зашивают локаль', () => {
    const hits: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (EXEMPT.has(rel)) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        // Комментарии не код: правило описано словами в нескольких местах.
        const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\/\/.*$/, '');
        for (const rule of RULES) {
          if (rule.re.test(code)) hits.push(`src/${rel}:${i + 1} :: ${rule.name} :: ${line.trim()}`);
        }
      });
    }
    expect(hits, 'форматировать через formatDay / formatMoment / formatNumber из src/domain/dates.ts').toEqual([]);
  });

  it('в списке исключений нет файлов, которых больше нет', () => {
    const present = new Set(files.map((f) => relative(ROOT, f).split(sep).join('/')));
    expect([...EXEMPT.keys()].filter((f) => !present.has(f))).toEqual([]);
  });
});
