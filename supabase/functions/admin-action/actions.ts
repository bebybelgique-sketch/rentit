// supabase/functions/admin-action/actions.ts
//
// Что администратору РАЗРЕШЕНО сделать — списком, и разбор входящего тела.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Ровно та же причина, что у `_shared/sweep.ts`: это
// единственное место, решающее, что попадёт в update над чужой строкой, и
// проверять его выкаткой в прод нельзя. Здесь нет ни Deno, ни сети, ни
// supabase-js — только разбор, — поэтому файл запускается обычным vitest
// (`__tests__/actions.test.ts`), а функция рядом остаётся тонкой.
//
// ПОЧЕМУ РАЗМЕЧЕННОЕ ОБЪЕДИНЕНИЕ, А НЕ `{ table, patch }`. Обобщённая
// админ-ручка вида «применить patch к строке таблицы» — это тот же прямой
// UPDATE, только через служебный ключ и без RLS. Список действий закрыт:
// чего в нём нет, того сделать нельзя, и добавление нового требует правки
// этого файла и его теста.

export type AdminAction =
  | { type: 'set_user_role'; user_id: string; role: 'user' | 'admin' }
  | { type: 'set_item_available'; item_id: string; available: boolean }
  // Чтение, а не действие: счётчики площадки целиком. Живёт здесь, потому
  // что под правами самого администратора их не сосчитать — RLS на
  // bookings показывает ему только его собственные брони, и вкладка Stats
  // годами показывала личные цифры под видом общих.
  | { type: 'get_stats' }

/** Куда пишет действие: таблица и строка, ради журнала и ради update. */
export interface AdminTarget {
  table: 'users' | 'items'
  id: string
}

// Версии 1–8 и вариант Microsoft. `role` в третьей группе намеренно
// свободный: id приходит из базы, а не из нашего генератора, и придираться
// к версии чужого uuid — способ однажды отказать по формальности.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

/**
 * Разбирает тело запроса. `null` — тело не является известным действием;
 * причину наружу не сообщаем: гадать по подсказкам сервера, какое действие
 * существует, никому не нужно, а в логе функции запрос виден целиком.
 */
export function parseAction(raw: unknown): AdminAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = raw as Record<string, unknown>

  switch (b.type) {
    case 'set_user_role': {
      if (!isUuid(b.user_id)) return null
      if (b.role !== 'user' && b.role !== 'admin') return null
      // Собираем НОВЫЙ объект, а не возвращаем `b as AdminAction`: иначе
      // лишние поля из тела доехали бы до update и до журнала.
      return { type: 'set_user_role', user_id: b.user_id, role: b.role }
    }

    case 'set_item_available': {
      if (!isUuid(b.item_id)) return null
      if (typeof b.available !== 'boolean') return null
      return { type: 'set_item_available', item_id: b.item_id, available: b.available }
    }

    case 'get_stats':
      return { type: 'get_stats' }

    default:
      return null
  }
}

/**
 * Над чем действие работает. Одна карта на update и на журнал — чтобы в
 * логе не оказалось таблицы, отличной от той, куда на самом деле писали.
 *
 * `null` — действие ничего не меняет (чтение). Такие в журнал не пишутся:
 * строка на каждое открытие вкладки Stats утопила бы в шуме те записи,
 * ради которых журнал заведён.
 */
export function targetOf(action: AdminAction): AdminTarget | null {
  switch (action.type) {
    case 'set_user_role':
      return { table: 'users', id: action.user_id }
    case 'set_item_available':
      return { table: 'items', id: action.item_id }
    case 'get_stats':
      return null
  }
}

/** Что именно меняется в строке. Значения уже проверены parseAction. */
export function patchOf(action: AdminAction): Record<string, unknown> {
  switch (action.type) {
    case 'set_user_role':
      return { role: action.role }
    case 'set_item_available':
      return { available: action.available }
    case 'get_stats':
      return {}
  }
}

/**
 * Предохранитель: администратор не снимает права сам с себя.
 *
 * Не «на всякий случай». Администраторов на площадке считанные единицы, и
 * один промах по кнопке в собственной строке закрывает вход в админку всем
 * — восстановить можно будет только руками в SQL-консоли.
 */
export function isSelfDemotion(action: AdminAction, callerId: string): boolean {
  return action.type === 'set_user_role' && action.user_id === callerId && action.role !== 'admin'
}
