import { describe, it, expect } from 'vitest';
import { parseAction, targetOf, patchOf, isSelfDemotion } from '../actions';

// Разбор входа для единственной ручки, которая пишет в чужие строки
// служебным ключом, то есть в обход RLS. Проверяем не «что-то вернулось»,
// а что список действий ЗАКРЫТ и что из тела запроса не проезжает ничего
// сверх разобранного.

const ADMIN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('parseAction', () => {
  it('принимает смену роли', () => {
    expect(parseAction({ type: 'set_user_role', user_id: OTHER, role: 'admin' }))
      .toEqual({ type: 'set_user_role', user_id: OTHER, role: 'admin' });
  });

  it('принимает скрытие объявления', () => {
    expect(parseAction({ type: 'set_item_available', item_id: OTHER, available: false }))
      .toEqual({ type: 'set_item_available', item_id: OTHER, available: false });
  });

  it('отвергает неизвестное действие', () => {
    expect(parseAction({ type: 'delete_user', user_id: OTHER })).toBeNull();
    expect(parseAction({ type: 'set_user_role_v2', user_id: OTHER, role: 'admin' })).toBeNull();
  });

  it('отвергает роль вне списка', () => {
    // 'superadmin' в enum отсутствует: запись прошла бы, а смысла у неё
    // не было бы никакого — и такой пользователь не был бы ни тем, ни другим.
    expect(parseAction({ type: 'set_user_role', user_id: OTHER, role: 'superadmin' })).toBeNull();
    expect(parseAction({ type: 'set_user_role', user_id: OTHER, role: '' })).toBeNull();
    expect(parseAction({ type: 'set_user_role', user_id: OTHER })).toBeNull();
  });

  it('отвергает нестрогое «доступно»', () => {
    // Без этой проверки 'false' строкой и 0 числом приехали бы в update, а
    // Postgres истолковал бы их по-своему.
    expect(parseAction({ type: 'set_item_available', item_id: OTHER, available: 'false' })).toBeNull();
    expect(parseAction({ type: 'set_item_available', item_id: OTHER, available: 0 })).toBeNull();
  });

  it('отвергает не-uuid в цели', () => {
    expect(parseAction({ type: 'set_user_role', user_id: 'me', role: 'admin' })).toBeNull();
    // Попытка задеть больше одной строки: PostgREST такого фильтра не
    // построит, но проверять это надо здесь, а не надеяться на него.
    expect(parseAction({ type: 'set_user_role', user_id: `${OTHER}' or '1'='1`, role: 'admin' })).toBeNull();
  });

  it('отвергает мусор вместо тела', () => {
    expect(parseAction(null)).toBeNull();
    expect(parseAction('set_user_role')).toBeNull();
    expect(parseAction([{ type: 'set_user_role', user_id: OTHER, role: 'admin' }])).toBeNull();
  });

  it('не пропускает посторонние поля', () => {
    // Главное свойство разбора: в update и в журнал попадает РОВНО
    // разобранное. Иначе ручка «смени роль» стала бы ручкой «поменяй в
    // строке пользователя что угодно».
    const parsed = parseAction({
      type: 'set_user_role',
      user_id: OTHER,
      role: 'admin',
      phone_verified: true,
      is_pro: true,
    });
    expect(parsed).toEqual({ type: 'set_user_role', user_id: OTHER, role: 'admin' });
    expect(patchOf(parsed!)).toEqual({ role: 'admin' });
  });
});

describe('targetOf / patchOf', () => {
  it('роль пишется в users, доступность — в items', () => {
    expect(targetOf({ type: 'set_user_role', user_id: OTHER, role: 'user' }))
      .toEqual({ table: 'users', id: OTHER });
    expect(targetOf({ type: 'set_item_available', item_id: OTHER, available: true }))
      .toEqual({ table: 'items', id: OTHER });
  });

  it('патч содержит один столбец', () => {
    expect(patchOf({ type: 'set_user_role', user_id: OTHER, role: 'user' })).toEqual({ role: 'user' });
    expect(patchOf({ type: 'set_item_available', item_id: OTHER, available: false }))
      .toEqual({ available: false });
  });
});

describe('isSelfDemotion', () => {
  it('ловит снятие прав с себя', () => {
    expect(isSelfDemotion({ type: 'set_user_role', user_id: ADMIN, role: 'user' }, ADMIN)).toBe(true);
  });

  it('не мешает снимать права с другого', () => {
    expect(isSelfDemotion({ type: 'set_user_role', user_id: OTHER, role: 'user' }, ADMIN)).toBe(false);
  });

  it('не мешает подтвердить собственную роль', () => {
    expect(isSelfDemotion({ type: 'set_user_role', user_id: ADMIN, role: 'admin' }, ADMIN)).toBe(false);
  });

  it('к объявлениям отношения не имеет', () => {
    expect(isSelfDemotion({ type: 'set_item_available', item_id: ADMIN, available: false }, ADMIN)).toBe(false);
  });
});
