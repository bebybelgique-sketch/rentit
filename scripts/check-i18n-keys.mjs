// Каждый t('...') из кода обязан существовать во всех трёх словарях
// ИМЕННО СТРОКОЙ.
//
// Два разных способа получить одно и то же на экране:
//   1) ключа нет вовсе      → i18next печатает сам ключ: "loading";
//   2) ключ есть, но это объект (пространство имён) → i18next печатает
//      «key 'myItems (fr)' returned an object instead of string.».
//
// Второй случай — не теория: перенос 121 строки в словари (#30) завёл
// пространства `listItem`/`myItems`/`myRentals` поверх одноимённых
// плоских строк навбара, и эта английская фраза висела в проде у каждого
// вошедшего пользователя. Поэтому проверка не на «ключ есть», а на
// `typeof === 'string'`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

export const collectUsedKeys = () => {
  const files = walk(root).filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'));
  const used = new Map();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // Самописной src/i18n/ больше нет (снята 12.08), в проекте одна
    // система — react-i18next. Отбор по useTranslation остаётся, чтобы
    // не ловить t() чужой природы (например, из тестовых утилит).
    if (!src.includes('useTranslation')) continue;
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      if (!used.has(m[1])) used.set(m[1], []);
      used.get(m[1]).push(f.replace(root, 'src'));
    }
  }
  return used;
};

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

// Множественное число i18next хранит суффиксами: `photosLeft_one`,
// `photosLeft_other`. В коде при этом зовут БАЗОВОЕ имя —
// `t('photosLeft', { count })`, — и суффикс подставляет сама библиотека.
//
// Первая версия этой проверки требовала точного совпадения и потому
// объявляла такие ключи пропавшими. Хуже, чем бесполезно: она толкала
// писать `t(count > 1 ? 'x_other' : 'x_one')` — то есть вручную повторять
// правила языка, которых в нидерландском и французском не две штуки.
// Проверка обязана понимать идиому библиотеки, а не гнуть код под себя.
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

const pluralFormsOf = (dict, key) =>
  PLURAL_SUFFIXES.filter((s) => typeof get(dict, `${key}_${s}`) === 'string');

// Возвращает [{ key, where, missing: ['fr', …], reason }], пустой массив = чисто.
export const findMissingKeys = () => {
  const used = collectUsedKeys();
  const dicts = Object.fromEntries(['fr', 'en', 'nl'].map((l) => [
    l, JSON.parse(readFileSync(`${root}/locales/${l}.json`, 'utf8')),
  ]));

  const problems = [];
  for (const [key, where] of [...used].sort()) {
    const missing = [];
    let reason = 'ключа нет';
    const pluralSets = {};

    for (const [lang, dict] of Object.entries(dicts)) {
      const value = get(dict, key);
      if (typeof value === 'string') continue;

      // Ключ может быть множественным: сам он строкой не лежит, но лежат
      // его формы. `_other` обязательна — на неё i18next откатывается.
      const forms = pluralFormsOf(dict, key);
      if (forms.includes('other')) { pluralSets[lang] = forms.join('/'); continue; }
      if (forms.length) {
        missing.push(lang);
        reason = `есть формы ${forms.join('/')}, но нет обязательной _other`;
        continue;
      }

      missing.push(lang);
      if (value !== undefined) reason = 'ключ есть, но это объект — i18next напечатает служебную фразу';
    }

    // Набор форм обязан совпадать между языками: если во французском есть
    // `_one`, а в нидерландском нет, единственное число молча отвалится на
    // `_other` — и текст будет грамматически неверным ровно в одном языке.
    const sets = [...new Set(Object.values(pluralSets))];
    if (!missing.length && sets.length > 1) {
      problems.push({
        key, where, missing: Object.keys(pluralSets),
        reason: `формы множественного числа расходятся: ${Object.entries(pluralSets).map(([l, f]) => `${l}=${f}`).join(', ')}`,
      });
      continue;
    }

    if (missing.length) problems.push({ key, where, missing, reason });
  }
  return problems;
};

// Прямой запуск: печатаем и возвращаем код.
if (process.argv[1] && process.argv[1].endsWith('check-i18n-keys.mjs')) {
  const used = collectUsedKeys();
  const problems = findMissingKeys();
  console.log(`ключей в коде: ${used.size}`);
  for (const p of problems) {
    console.log(`ПРОВАЛ  ${p.key} — нет в: ${p.missing.join(', ')}  (${p.where[0]})`);
    console.log(`        ${p.reason}`);
  }
  console.log(problems.length === 0
    ? 'все ключи есть во всех трёх языках'
    : `${problems.length} ключей не хватает`);
  process.exit(problems.length ? 1 : 0);
}
