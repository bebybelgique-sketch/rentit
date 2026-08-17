// scripts/check-availability-single-source.mjs
//
// Стережёт то, ради чего 17.08 переписывался расчёт занятости: чтобы он
// снова не расползся по продукту.
//
// К 17.08.2026 одно правило «свободна ли вещь на эти даты» было записано в
// ПЯТИ местах — триггер, фильтр витрины, данные календаря, функция
// isBooked() в браузере и запрос conflict в request-rental. Два из пяти
// уже разошлись: триггер не считал занятым pending_payment, витрина
// считала. Появление количества единиц потребовало переписать все пять, и
// шестая копия обесценит работу целиком.
//
// Что проверяется:
//
//   1. В `src/` и `supabase/functions/` нет арифметики пересечения дат
//      брони: ни daterange(), ни фильтров PostgREST по start_date /
//      end_date, ни сравнений этих полей операторами. Пересечения считает
//      база, код только спрашивает.
//
//   2. В `supabase/migrations/` daterange() допустим только в файлах НЕ
//      НОВЕЕ миграции-источника. Более поздняя миграция, которой он
//      понадобился, обязана сначала объясниться здесь — то есть человек
//      обязан прочитать это и решить осознанно, а не добавить шестую копию
//      по привычке.
//
// Запуск: node scripts/check-availability-single-source.mjs
// В наборе тестов: src/__tests__/availability-single-source.test.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Где ищем код, который не вправе считать пересечения сам. */
const CODE_DIRS = ['src', 'supabase/functions'];
const CODE_EXT = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx']);

/** Миграция, ставшая источником правды. Всё до неё — история. */
export const SOURCE_MIGRATION = '20260817000022_availability_one_source.sql';

const RULES = [
  {
    name: 'daterange()',
    re: /\bdaterange\s*\(/,
    why: 'пересечение дат считает база (public.unavailable_days)',
  },
  {
    name: 'фильтр PostgREST по датам брони',
    re: /\.(lte|gte|lt|gt)\(\s*['"`](start_date|end_date)['"`]/,
    why: 'вместо своего запроса — item_calendar / unavailable_days',
  },
  {
    name: 'сравнение start_date / end_date оператором',
    re: /(\b(start_date|end_date)\s*(<=|>=|<[^=]|>[^=]))|((<=|>=|[^=<>]<|[^=<>-]>)\s*[\w.]*\b(start_date|end_date)\b)/,
    why: 'день недоступен или нет — отвечает база, а не сравнение здесь',
  },
];

/**
 * Файлы, которым правило не адресовано. Список намеренно короткий: чем он
 * длиннее, тем меньше значит сама проверка.
 */
const EXEMPT = new Set([
  // Общий модуль: он и есть то единственное место, что задаёт вопрос базе.
  // Своей арифметики в нём нет — запись здесь на случай, если появится
  // строка вида `p_start`/`p_end` рядом с оператором.
  'supabase/functions/_shared/availability.ts',
]);

/**
 * Отдельные строки, которые правилу не подчиняются, — и ПОЧЕМУ.
 * Исключение целым файлом спрятало бы будущую копию в том же файле,
 * поэтому сверяемся с текстом строки, а не с номером: номера съезжают.
 *
 * Список обязан оставаться коротким. Каждая запись — это место, где
 * человек посмотрел и сказал «это другое правило».
 */
const EXEMPT_LINES = [
  {
    file: 'supabase/functions/expire-bookings/index.ts',
    code: ".lt('end_date', graceEnd)",
    why: 'срок аренды прошёл — правило жизненного цикла брони, не занятость вещи',
  },
];

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      walk(full, out);
    } else if (CODE_EXT.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** Все нарушения: `путь:строка :: правило :: строка кода`. */
export function findOverlapArithmetic() {
  const hits = [];
  for (const dir of CODE_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const r = rel(file);
      if (EXEMPT.has(r)) continue;
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        // Комментарии не код: этот же класс описан словами в нескольких
        // файлах, и запрещать о нём ПИСАТЬ бессмысленно.
        const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '');
        const trimmed = line.trim();
        if (EXEMPT_LINES.some((e) => e.file === r && e.code === trimmed)) return;
        for (const rule of RULES) {
          if (rule.re.test(code)) hits.push(`${r}:${i + 1} :: ${rule.name} :: ${trimmed}`);
        }
      });
    }
  }
  return hits.sort();
}

/** Миграции новее источника, в которых снова появился daterange(). */
export function findLateMigrationsWithOverlap() {
  const dir = path.join(ROOT, 'supabase/migrations');
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')); } catch { return []; }
  return files
    .filter((f) => f > SOURCE_MIGRATION)
    .filter((f) => /\bdaterange\s*\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort();
}

/** Проверка, которая ничего не находит, неотличима от сломанной. */
export function countScannedFiles() {
  return CODE_DIRS.reduce((n, d) => n + walk(path.join(ROOT, d)).length, 0);
}

/**
 * Исключения, которых в коде больше нет. Список обязан описывать ФАКТ:
 * строка, которую уже переписали, должна из него уйти, иначе он тихо
 * начинает прикрывать что-то другое.
 */
export function findStaleExemptions() {
  return EXEMPT_LINES.filter((e) => {
    const full = path.join(ROOT, e.file);
    if (!fs.existsSync(full)) return true;
    const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/).map((l) => l.trim());
    return !lines.includes(e.code);
  }).map((e) => `${e.file} :: ${e.code}`);
}

// Сравнение с import.meta.url на Windows не работает: там file:///C:/…
// против C:\… . Проверка по имени файла — так же, как в соседних гейтах.
if (process.argv[1] && process.argv[1].endsWith('check-availability-single-source.mjs')) {
  const hits = findOverlapArithmetic();
  const late = findLateMigrationsWithOverlap();
  console.log(`Просмотрено файлов: ${countScannedFiles()}`);
  if (hits.length) {
    console.error('\nАрифметика пересечения дат вне базы:');
    for (const h of hits) console.error('  ' + h);
  }
  if (late.length) {
    console.error('\nМиграции новее источника с daterange():');
    for (const f of late) console.error('  ' + f);
  }
  if (hits.length || late.length) {
    console.error('\nЗанятость считает public.unavailable_days. Спрашивать её');
    console.error('через supabase/functions/_shared/availability.ts.');
    process.exit(1);
  }
  console.log('Чисто: расчёт занятости в одном месте.');
}
