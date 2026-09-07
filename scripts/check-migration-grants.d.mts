// Типы для сторожа привилегий: сам он на .mjs, потому что запускается
// напрямую через node. Импортирует его тест внутри src/, а tsc проверяет src/
// строго — без этого файла сборка падает на implicit any (и падает именно на
// Vercel, потому что vitest не зовёт tsc).

/** Один файл миграции: имя определяет порядок применения. */
export interface MigrationFile {
  name: string;
  sql: string;
}

/** Разобранный оператор GRANT или REVOKE. */
export interface GrantStatement {
  kind: 'grant' | 'revoke';
  /** Привилегии: SELECT, INSERT, … или ALL. Колоночный список сюда не входит. */
  privs: string[];
  /** Колоночный грант (`GRANT SELECT (a, b) ON …`) — состояние он не меняет. */
  columnLevel: boolean;
  objectType: 'table' | 'function' | 'schema' | 'sequence' | 'all-in-schema';
  /** Объекты в виде `схема.имя`; таблица без схемы считается public. */
  objects: string[];
  roles: string[];
}

/** Правило для одной таблицы: чего клиентской роли иметь нельзя и почему. */
export interface GrantRule {
  forbid: string[];
  why: string;
}

/** Роли, которыми ходит браузер. Ключ anon лежит в бандле — он публичный. */
export declare const CLIENT_ROLES: string[];

/** Поднадзорные таблицы: `схема.имя → правило`. */
export declare const RULES: Record<string, GrantRule>;

/** Убрать комментарии SQL до разбора. */
export function stripComments(sql: string): string;

/** Операторы GRANT/REVOKE из одного файла. */
export function parseStatements(sql: string): GrantStatement[];

/** Файлы миграций в порядке применения. */
export function migrationFiles(): string[];

/**
 * Проиграть миграции по порядку. Возвращает итоговые ТАБЛИЧНЫЕ привилегии
 * клиентских ролей (`Map<'role|schema.table', Set<PRIV>>`) и список форм,
 * которые сторож не разбирает, — молча их пропускать нельзя.
 */
export function replayGrants(files?: MigrationFile[]): {
  state: Map<string, Set<string>>;
  unsupported: string[];
};

/** Нарушения правил в итоговом состоянии. Пусто = чисто. */
export function findViolations(files?: MigrationFile[]): string[];

/** Сколько операторов разобрано. Ноль = разбор сломан. */
export function countStatements(): number;
