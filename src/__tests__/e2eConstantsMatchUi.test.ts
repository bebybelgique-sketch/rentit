import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Константы сквозной оснастки обязаны совпадать с тем, что продукт РИСУЕТ.
 *
 * ЗАЧЕМ. 19.09.2026 из интерфейса сняли цветные эмодзи. Подписи стали
 * чистыми, а `tests/helpers/app.ts` остался прежним: `UI.nearby` искал
 * кнопку «📍 À proximité», `CATEGORY_LABEL` — «⚡ Électroportatif» и ещё
 * пять. Девять сценариев искали значок, которого на экране уже не было.
 *
 * Заметили это через ДВЕНАДЦАТЬ ДНЕЙ, и только потому, что кто-то открыл
 * историю прогонов: джоб `browser` гоняется лишь на push в main, а папку
 * `tests/` не покрывал ни один гейт. Проверка, которая ловит расхождение
 * за сорок секунд в наборе, стоит двенадцати дней красного CI.
 *
 * ПОЧЕМУ РАЗБОР ТЕКСТОМ, А НЕ ИМПОРТОМ. `helpers/app.ts` тянет
 * `@playwright/test`; импортировать его в юнит-прогон значит затащить туда
 * playwright целиком. Тот же приём уже применён к index.css и к workflow.
 */

const root = process.cwd();
const rawHelpers = readFileSync(join(root, 'tests', 'helpers', 'app.ts'), 'utf8');
const fr = JSON.parse(readFileSync(join(root, 'src', 'locales', 'fr.json'), 'utf8'));

// Комментарии ГАСЯТСЯ, а не вырезаются: в них встречаются и кавычки, и
// двоеточия, и сами подписи — разбор принял бы их за константы.
const helpers = rawHelpers
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

const LITERAL = /(\w+)\s*:\s*(["'])((?:\\.|(?!\2).)*)\2/g;
const UNESCAPE = /\\(.)/g;

const constantsOf = (name: string): Array<[string, string]> => {
  const at = helpers.indexOf(`export const ${name} = {`);
  if (at < 0) throw new Error(`в helpers/app.ts нет ${name}`);
  const end = helpers.indexOf('} as const', at);
  if (end < 0) throw new Error(`${name} не закрыт '} as const'`);
  return [...helpers.slice(at, end).matchAll(LITERAL)]
    .map(([, key, , value]) => [key, value.replace(UNESCAPE, '$1')] as [string, string]);
};

/** Все строки словаря, на любой глубине. */
const dictionaryValues = (() => {
  const out = new Set<string>();
  const walk = (o: unknown) => {
    if (typeof o === 'string') { out.add(o); return; }
    if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(fr);
  return out;
})();

/**
 * Строки, вшитые в разметку мимо словарей, — их сторожит отдельный гейт
 * (check-hardcoded-text) и его замороженный список. Пока они в продукте
 * есть, оснастка вправе их искать, поэтому исходники тоже считаются
 * источником правды.
 */
const sourceText = ['src/pages', 'src/components', 'src/App.tsx'];
const sources = (() => {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  return sourceText
    .map((p) => join(root, p))
    .flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p]))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
})();

// Звёздочка обязательного поля дорисовывается разметкой, в словаре её нет.
const normalise = (s: string) => s.replace(/\s*\*$/, '').trim();

const productShows = (value: string) =>
  dictionaryValues.has(value) ||
  dictionaryValues.has(normalise(value)) ||
  sources.includes(value);

describe('константы сквозной оснастки не расходятся с продуктом', () => {
  it('разбор вообще видит константы', () => {
    expect(constantsOf('UI').length).toBeGreaterThan(20);
    expect(constantsOf('CATEGORY_LABEL')).toHaveLength(6);
  });

  it.each(['UI', 'CATEGORY_LABEL'])('%s: каждую подпись продукт действительно показывает', (name) => {
    const lost = constantsOf(name)
      .filter(([, value]) => !productShows(value))
      .map(([key, value]) => `${name}.${key} = ${JSON.stringify(value)}`);

    expect(lost, `подписи нет ни в словаре, ни в разметке:\n  ${lost.join('\n  ')}`).toEqual([]);
  });

  // Прямой сторож против ровно того, что случилось: эмодзи в продукте нет
  // (их держит check-emoji-in-ui), значит и в оснастке им взяться неоткуда.
  it('в константах нет цветных эмодзи — в продукте их тоже нет', () => {
    const withEmoji = [...constantsOf('UI'), ...constantsOf('CATEGORY_LABEL')]
      .filter(([, value]) => /\p{Emoji_Presentation}/u.test(value))
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);

    expect(withEmoji, `эмодзи в оснастке:\n  ${withEmoji.join('\n  ')}`).toEqual([]);
  });

  // Категории — самая частая точка расхождения: их подписи живут в словаре
  // и повторены в оснастке. Сверяем поимённо, а не просто «где-то есть».
  it('CATEGORY_LABEL совпадает со словарём ключ в ключ', () => {
    for (const [key, value] of constantsOf('CATEGORY_LABEL')) {
      expect(fr.categories?.[key], `категория ${key}`).toBe(value);
    }
  });
});
