// Типы для храповика: сам он на .mjs, потому что запускается напрямую
// через node. Импортирует его тест внутри src/, а tsc проверяет src/
// строго — без этого файла сборка падает на implicit any (и падает
// именно на Vercel, потому что vitest не зовёт tsc).

/** Все попадания: `путь :: текст`, отсортированы, без повторов. */
export function findHardcodedText(): string[];

/** Замороженный список известных и принятых попаданий. */
export function readAllowlist(): Set<string>;

/** Попадания, которых нет в замороженном списке. Пусто = чисто. */
export function findNewHardcodedText(): string[];
