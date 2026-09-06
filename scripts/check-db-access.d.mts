// Типы для храповика прямого доступа к базе: сам он на .mjs, потому что
// запускается напрямую через node. Импортирует его тест внутри src/, а tsc
// проверяет src/ строго — без этого файла сборка падает на implicit any (и
// падает именно на Vercel, потому что vitest не зовёт tsc).

/** Обращений к базе в одном файле; комментарии не считаются. */
export function countInSource(source: string): number;

/** Сколько файлов реально просмотрено. Ноль = обход сломан. */
export function countScannedFiles(): number;

/** Файлы с прямым доступом: `путь → число обращений`. */
export function countDbAccess(): Map<string, number>;

/** Замороженный список: `путь → допустимое число`. */
export function readAllowlist(): Map<string, number>;

/** Где обращений стало больше разрешённого. Пусто = нового доступа нет. */
export function findExcess(): string[];

/** Где список отстал от кода. Пусто = список описывает факт. */
export function findStaleAllowlist(): string[];
