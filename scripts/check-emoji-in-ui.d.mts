// Типы для храповика эмодзи: сам он на .mjs, потому что запускается напрямую
// через node. Импортирует его тест внутри src/, а tsc проверяет src/ строго —
// без этого файла сборка падает на implicit any (и падает именно на Vercel,
// потому что vitest не зовёт tsc).

/** Цветные эмодзи в строке (Emoji_Presentation). Пусто = чисто. */
export function emojiIn(text: string): string[];

/** Плоский обход словаря: `ключ.через.точку → значение`. */
export function flatten(obj: object, prefix?: string): [string, unknown][];

/** Ключи, которым эмодзи разрешён поимённо. */
export function readAllowlist(): Set<string>;

/** Ключи словарей с цветными эмодзи, кроме разрешённых. */
export function findInLocales(): string[];

/** Места в разметке с цветными эмодзи: `путь:строка`. Комментарии не в счёт. */
export function findInSource(): string[];

/** Сколько файлов словарей просмотрено. Ноль = обход сломан. */
export function countLocales(): number;

/** Всё вместе. Пусто = чисто. */
export function findAll(): string[];
