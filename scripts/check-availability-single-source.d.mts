// Типы для стража единственного источника занятости: сам он на .mjs,
// потому что запускается напрямую через node. Импортирует его тест внутри
// src/, а tsc проверяет src/ строго — без этого файла сборка падает на
// implicit any (и падает именно на Vercel, потому что vitest не зовёт tsc).

/** Имя миграции, ставшей источником правды. */
export const SOURCE_MIGRATION: string;

/** Нарушения: `путь:строка :: правило :: строка кода`. Пусто = чисто. */
export function findOverlapArithmetic(): string[];

/** Миграции новее источника, в которых снова появился daterange(). */
export function findLateMigrationsWithOverlap(): string[];

/** Сколько файлов реально просмотрено. Ноль = обход сломан. */
export function countScannedFiles(): number;

/** Исключения, строк которых в коде больше нет. Пусто = список честен. */
export function findStaleExemptions(): string[];
