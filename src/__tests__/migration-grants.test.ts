import { describe, it, expect } from 'vitest';
import {
  CLIENT_ROLES,
  countStatements,
  findViolations,
  migrationFiles,
  parseStatements,
  replayGrants,
  stripComments,
} from '../../scripts/check-migration-grants.mjs';

// Сторож в наборе тестов, а не отдельной командой. Урок 14.08: проверка,
// которую надо не забыть запустить, однажды не запускается.
describe('привилегии клиентских ролей после всех миграций', () => {
  it('запрещённых привилегий не осталось', () => {
    const violations = findViolations();
    const report = violations.length
      ? `Клиентские роли держат то, что им запрещено:\n  ${violations.join('\n  ')}\n\n` +
        'Снять НОВОЙ миграцией (REVOKE), а не правкой уже применённой.\n' +
        'Если решение осознанное — менять RULES в scripts/check-migration-grants.mjs вместе с ADR.'
      : '';
    expect(report).toBe('');
  });

  // Проверка, которая ничего не находит, неотличима от сломанной: если разбор
  // перестанет видеть операторы, тест выше станет зелёным, не проверив ничего.
  it('разбор вообще видит миграции и операторы в них', () => {
    expect(migrationFiles().length).toBeGreaterThan(30);
    expect(countStatements()).toBeGreaterThan(30);
  });

  it('итоговое состояние не пустое: SELECT на bookings у клиента остался', () => {
    const { state } = replayGrants();
    expect(state.get('authenticated|public.bookings')?.has('SELECT')).toBe(true);
  });

  it('форму, которую сторож не разбирает, он не пропускает молча', () => {
    const hits = findViolations([
      { name: '01.sql', sql: 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;' },
    ]);
    expect(hits.join(' ')).toContain('не разбирает');
  });
});

// Ниже — те самые два промаха 05.09, дословно. Тест существует, чтобы
// сторожа нельзя было «починить» ослаблением: если правило исчезнет, эти
// проверки станут красными, а не зелёными.
describe('сторож ловит промахи, ради которых написан', () => {
  it('табличный GRANT SELECT на users открывает телефоны и одноразовые коды', () => {
    const hits = findViolations([
      { name: '07.sql', sql: 'REVOKE SELECT ON public.users FROM anon, authenticated;\nGRANT SELECT (id, full_name) ON public.users TO anon, authenticated;' },
      { name: '27.sql', sql: 'GRANT SELECT ON public.users, public.items TO anon, authenticated;' },
    ]);
    expect(hits.filter((h) => h.startsWith('public.users'))).toHaveLength(2); // обе роли
    expect(hits.join(' ')).toContain('phone_otp');
  });

  it('GRANT INSERT/UPDATE на bookings разворачивает миграции 09 и 12', () => {
    const hits = findViolations([
      { name: '27.sql', sql: 'GRANT INSERT ON public.bookings TO authenticated;\nGRANT UPDATE ON public.bookings TO authenticated;' },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('INSERT, UPDATE');
  });

  it('снятое новой миграцией больше не нарушение', () => {
    const hits = findViolations([
      { name: '27.sql', sql: 'GRANT INSERT, UPDATE ON public.bookings TO authenticated;' },
      { name: '33.sql', sql: 'REVOKE INSERT, UPDATE ON public.bookings FROM authenticated;' },
    ]);
    expect(hits).toEqual([]);
  });

  it('колоночный грант на users законен и нарушением не считается', () => {
    const hits = findViolations([
      { name: '07.sql', sql: 'GRANT SELECT (\n  id,\n  full_name,\n  village\n) ON public.users TO anon, authenticated;' },
    ]);
    expect(hits).toEqual([]);
  });

  it('GRANT ALL раскрывается в полный список, а не проходит как одно слово', () => {
    const hits = findViolations([{ name: '01.sql', sql: 'GRANT ALL ON public.bookings TO authenticated;' }]);
    expect(hits[0]).toContain('DELETE');
    expect(hits[0]).toContain('INSERT');
  });
});

describe('разбор операторов', () => {
  it('видит многострочный список таблиц и ролей', () => {
    const [st] = parseStatements('GRANT SELECT ON\n  public.items,\n  public.bookings\nTO anon,\n  authenticated;');
    expect(st.objects).toEqual(['public.items', 'public.bookings']);
    expect(st.roles).toEqual(['anon', 'authenticated']);
  });

  it('таблица без схемы считается таблицей public', () => {
    expect(parseStatements('GRANT SELECT ON TABLE bookings TO anon;')[0].objects).toEqual(['public.bookings']);
  });

  it('регистр не имеет значения: revoke all тоже оператор', () => {
    const [st] = parseStatements('revoke all on public.admin_audit_log from anon, authenticated;');
    expect(st.kind).toBe('revoke');
    expect(st.privs).toEqual(['ALL']);
  });

  it('гранты на функции к таблицам отношения не имеют', () => {
    expect(parseStatements('GRANT EXECUTE ON FUNCTION public.item_history(uuid) TO anon;')[0].objectType).toBe('function');
  });

  it('service_role под правило не подпадает: у него своя работа', () => {
    expect(findViolations([
      { name: '29.sql', sql: 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;' },
    ])).toEqual([]);
    expect(CLIENT_ROLES).not.toContain('service_role');
  });

  it('закомментированный грант грантом не считается', () => {
    expect(parseStatements('-- GRANT SELECT ON public.users TO anon;\n')).toHaveLength(0);
    expect(stripComments('/* GRANT ALL ON public.users TO anon; */').trim()).toBe('');
  });
});
