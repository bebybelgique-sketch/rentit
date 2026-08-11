// Типы для страж утверждений: сам он на .mjs, потому что запускается
// напрямую через node, без сборки. Но его импортирует тест внутри src/,
// а tsc проверяет src/ строго — без этого файла сборка падает на
// implicit any (и падала: Vercel вернул 2 там, где локальный прогон
// тестов ничего не заметил, потому что vitest не запускает tsc).

export interface ClaimViolation {
  rule: string;
  why: string;
  text: string;
}

export interface ClaimFileViolation extends ClaimViolation {
  file: string;
  line: number;
}

/** Разбирает произвольный текст. Нужен, чтобы проверять самого стража. */
export function checkText(text: string): ClaimViolation[];

/** Обходит src/ и возвращает все найденные нарушения. */
export function findClaimViolations(): ClaimFileViolation[];
