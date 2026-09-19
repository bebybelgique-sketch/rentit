import { describe, it, expect } from 'vitest';
import {
  CLIENT_ROLES,
  countStatements,
  findViolations,
  migrationFiles,
  parseStatements,
  replayGrants,
  skippedFiles,
  auditRatchet,
  loadAllowlist,
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

  // Промах 18.09: миграция 34 выдала tool_demands `grant insert` и считала,
  // что этим ограничила клиента. Умолчания Supabase (`alter default
  // privileges … grant all`) уже отдали ему всё; живая база ответила
  // GET → 200, PATCH → 204, DELETE → 204. Сторож этого увидеть не может — он
  // читает только миграции, — но обязан ловить хотя бы ЯВНО написанное.
  it('SELECT на tool_demands клиенту — нарушение', () => {
    const hits = findViolations([
      { name: '34.sql', sql: 'grant insert on public.tool_demands to anon, authenticated;' },
      { name: 'x.sql', sql: 'grant select on public.tool_demands to authenticated;' },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('SELECT');
  });

  it('revoke all + grant insert — то, чего от новой таблицы и ждут', () => {
    expect(findViolations([
      { name: '36.sql', sql: 'revoke all on public.tool_demands from anon, authenticated;\ngrant insert on public.tool_demands to anon, authenticated;' },
    ])).toEqual([]);
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

// ────────────────────────────────────────────────────────────────────────
// Ниже — то, чего сторож не видел до 19.09.2026. Обе слепые зоны были
// обитаемы, и обе нашлись не им, а живой базой и выводом CLI.
// ────────────────────────────────────────────────────────────────────────

describe('умолчания Supabase: новая таблица рождается с ПОЛНЫМИ правами', () => {
  // Слепая зона №1. В схеме public стоит
  //   alter default privileges … grant all on tables to anon, authenticated
  // Ни строки об этом в миграциях нет, поэтому таблицу, которой никто явно
  // ничего не снимал, сторож считал чистой. Ровно так он согласился с
  // миграцией 34, пока живая база не ответила GET 200, PATCH 204, DELETE 204.
  it('create table засеивает полный набор прав обеим клиентским ролям', () => {
    const { state } = replayGrants([
      { name: '01.sql', sql: 'create table public.gadgets (id uuid primary key);' },
    ]);
    for (const role of CLIENT_ROLES) {
      const privs = state.get(`${role}|public.gadgets`);
      expect([...privs!].sort()).toEqual(
        ['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'],
      );
    }
  });

  it('один только grant права НЕ сужает — это и была иллюзия миграции 34', () => {
    const { state } = replayGrants([
      { name: '34.sql', sql: 'create table public.gadgets (id uuid);\ngrant insert on public.gadgets to anon, authenticated;' },
    ]);
    // SELECT никто не выдавал — и он всё равно есть, из умолчания.
    expect(state.get('anon|public.gadgets')?.has('SELECT')).toBe(true);
  });

  it('revoke all перед grant — то, что действительно сужает', () => {
    const { state } = replayGrants([
      { name: '34.sql', sql: 'create table public.gadgets (id uuid);\nrevoke all on public.gadgets from anon, authenticated;\ngrant insert on public.gadgets to anon, authenticated;' },
    ]);
    expect([...state.get('anon|public.gadgets')!]).toEqual(['INSERT']);
  });

  // ГРАНИЦА МОДЕЛИ, записанная явно, чтобы на неё не наткнулись как на
  // сюрприз. Засев идёт перед ВСЕМИ операторами файла, а не на своём месте
  // в тексте: сторож не исполняет SQL, он считает итог. Поэтому revoke,
  // написанный ВЫШЕ create table, модель учтёт, а живая база отвергнет
  // («relation does not exist»). Расхождение безопасно ровно в одну
  // сторону: модель покажет права УЖЕ, чем на самом деле, и такая миграция
  // до прода не доедет — упадёт при применении.
  it('засев предшествует операторам файла, чем бы ни был их порядок в тексте', () => {
    const { state } = replayGrants([
      { name: '01.sql', sql: 'revoke all on public.gadgets from anon, authenticated;\ncreate table public.gadgets (id uuid);' },
    ]);
    expect(state.get('anon|public.gadgets')).toBeUndefined();
  });

  it('таблицы вне схемы public не засеиваются: умолчание стоит на public', () => {
    const { state } = replayGrants([
      { name: '01.sql', sql: 'create table auth.sessions (id uuid);' },
    ]);
    expect(state.get('anon|auth.sessions')).toBeUndefined();
  });
});

describe('файлы, которые db push пропускает', () => {
  // Слепая зона №2. `supabase migration list` говорит вслух:
  //   Skipping migration add_events_table.sql...
  //   (file name must match pattern "<timestamp>_name.sql")
  // Сторож же читал этот файл и отчитывался о привилегиях таблицы, которой
  // в базе из миграций не существует.
  it('в разбор попадают только имена вида <timestamp>_name.sql', () => {
    expect(migrationFiles().every((f) => /^\d+_.+\.sql$/.test(f))).toBe(true);
  });

  it('пропущенные не исчезают молча — их возвращают отдельно', () => {
    expect(skippedFiles()).toContain('add_events_table.sql');
  });

  it('пропущенный файл и в разбор не попал', () => {
    expect(migrationFiles()).not.toContain('add_events_table.sql');
  });
});

describe('храповик: поверхность заморожена поимённо', () => {
  // RULES покрывает три таблицы. Остальные шесть до 19.09 не смотрел никто,
  // и вырасти они могли бы молча.
  it('сегодняшняя явь совпадает со списком', () => {
    const { appeared, vanished } = auditRatchet();
    expect({ appeared, vanished }).toEqual({ appeared: [], vanished: [] });
  });

  it('новая привилегия, которой нет в списке, — красный', () => {
    const { appeared } = auditRatchet(
      [{ name: '99.sql', sql: 'grant update on public.bookings to authenticated;' }],
      { 'public.bookings': { why: 'проба: клиенту оставлено только чтение', anon: [], authenticated: ['SELECT'] } },
    );
    expect(appeared.join(' ')).toContain('UPDATE');
  });

  // Сверка в ОБЕ стороны. Список, из которого не убирают снятое, за полгода
  // превращается в художественное произведение — и врать начинает он.
  it('снятая привилегия, оставшаяся в списке, — тоже красный', () => {
    const { vanished } = auditRatchet(
      [{ name: '99.sql', sql: 'revoke select on public.bookings from authenticated;' }],
      { 'public.bookings': { why: 'проба: клиенту оставлено только чтение', anon: [], authenticated: ['SELECT'] } },
    );
    expect(vanished.join(' ')).toContain('SELECT');
  });

  it('у каждой замороженной таблицы есть пояснение why', () => {
    for (const [table, entry] of Object.entries(loadAllowlist())) {
      expect(typeof entry.why, `${table} без пояснения`).toBe('string');
      expect(entry.why.length, `${table}: пояснение пустое`).toBeGreaterThan(20);
    }
  });
});
