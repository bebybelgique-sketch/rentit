// Каждый t('...') из кода обязан существовать во всех трёх словарях.
// Отсутствующий ключ i18next выводит как есть — пользователь видит
// "rental.labelItem" вместо слова.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk(root).filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'));

// В проекте две системы переводов. Старая (src/i18n/*.ts) экспортирует
// собственный t и живёт на плоских ключах; новая — react-i18next на
// locales/*.json. Проверять надо только вторую, иначе каждый ключ старой
// системы выглядит как пропажа.
const used = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes('useTranslation')) continue;
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(f.replace(root, 'src'));
  }
}

const dicts = Object.fromEntries(['fr', 'en', 'nl'].map((l) => [
  l, JSON.parse(readFileSync(`${root}/locales/${l}.json`, 'utf8')),
]));

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

let fail = 0;
console.log(`ключей в коде: ${used.size}`);
for (const [key, where] of [...used].sort()) {
  const missing = Object.entries(dicts).filter(([, d]) => typeof get(d, key) !== 'string').map(([l]) => l);
  if (missing.length) {
    console.log(`ПРОВАЛ  ${key} — нет в: ${missing.join(', ')}  (${where[0]})`);
    fail++;
  }
}
console.log(fail === 0 ? 'все ключи есть во всех трёх языках' : `${fail} ключей не хватает`);
process.exit(fail ? 1 : 0);
