// Типы для храповика снятой палитры: сам он на .mjs, потому что
// запускается напрямую через node. Импортирует его тест внутри src/, а tsc
// проверяет src/ строго — без этого файла сборка падает на implicit any (и
// падает именно на Vercel, потому что vitest не зовёт tsc).

/** Снятые цвета и чем каждый заменён. */
export declare const RETIRED: Record<string, string>;

/** Убрать комментарии: они хранят причину снятия и запретом не считаются. */
export function stripComments(source: string): string;

/** Сколько снятых цветов в одном исходнике: `'#HEX' → число`. */
export function countInSource(source: string): Record<string, number>;

/** Сколько файлов просмотрено. Ноль = обход сломан. */
export function countScannedFiles(): number;

/** Файлы со снятой палитрой: `путь → { '#HEX': число }`. */
export function countRetired(): Map<string, Record<string, number>>;

/** Замороженный список: `путь → { '#HEX': допустимое число }`. */
export function readAllowlist(): Map<string, Record<string, number>>;

/** Где снятых цветов стало больше разрешённого. Пусто = чисто. */
export function findExcess(): string[];

/** Где список отстал от кода. Пусто = список описывает факт. */
export function findStaleAllowlist(): string[];
