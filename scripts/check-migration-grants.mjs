// Сторож привилегий: чего клиентские роли не должны получить НИКОГДА.
//
// ЗАЧЕМ. 05.09 миграция 20260905000027 первой своей версией написала
// `GRANT SELECT ON public.users TO anon, authenticated`. Одна строка
// разворачивала три предыдущие миграции сразу: 07 (спрятать phone_otp,
// phone_otp_expires_at, stripe_customer_id), 14 (спрятать phone, lat, lng)
// и урок, записанный в 17 открытым текстом — «колоночный REVOKE не
// вырезает дырку в табличном гранте». Табличный грант перекрывает
// колоночные: любой аноним с ключом из бандла прочитал бы телефоны, домашние
// координаты и ОДНОРАЗОВЫЕ КОДЫ ПОДТВЕРЖДЕНИЯ всех пользователей.
//
// Нашлось это глазами и починилось двумя коммитами следом в том же PR
// (99b3b9e, 1c6cec2). Ни один тест, ни один гейт и ни одна сборка не стали
// бы красными. Именно поэтому сторож существует: цена промаха — не падение,
// а тихая утечка, а замечает её только тот, кто помнит миграции 07, 14 и 17
// в момент чтения диффа.
//
// В том же наборе уцелело второе: `GRANT INSERT, UPDATE ON public.bookings
// TO authenticated`, разворот миграций 09 («бронь заводит только сервер») и
// 12 («статус меняет только сервер»). Снято миграцией 33.
//
// ПОЧЕМУ СЧИТАЕТСЯ СОСТОЯНИЕ, А НЕ ИЩЕТСЯ ТЕКСТ. Запрет на строку `GRANT …
// ON public.bookings` был бы вечно красным: миграция 27 уже в истории, а
// применённые миграции не переписывают. Поэтому GRANT и REVOKE
// проигрываются по порядку имён файлов, и проверяется ИТОГ — то же, что
// увидит `information_schema.role_table_grants` в живой базе. Побочная
// выгода: сторож так же ловит и «выдал в 40-й, забыл снять».
//
// ЧТО НЕ РАССМАТРИВАЕТСЯ. Гранты ролям service_role и postgres: они и так
// обходят RLS, это их работа. Гранты на функции (`ON FUNCTION`) — там
// граница проходит по SECURITY DEFINER и search_path, а не по привилегии.
//
// ЧЕГО СТОРОЖ НЕ ЗНАЕТ. Что применено на живой базе. Миграции здесь
// применяют руками (см. docs/sprint-1-dod.md), файл в репозитории говорит о
// НАМЕРЕНИИ. Сторож держит намерение непротиворечивым; сверку с базой
// делает schema-drift.yml и запрос из шапки миграции 33.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = join(root, 'supabase', 'migrations')

/** Роли, которыми ходит браузер. Ключ anon лежит в бандле — он публичный. */
export const CLIENT_ROLES = ['anon', 'authenticated']

const WRITE_PRIVS = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
const ALL_PRIVS = ['SELECT', ...WRITE_PRIVS]

/**
 * Правила. Не «все таблицы под подозрением», а поимённо те, где решение
 * принято и записано в миграции: список, который читают, а не угадывают.
 */
export const RULES = {
  // Миграции 07, 14, 17: у users клиент получает только КОЛОНОЧНЫЕ гранты.
  // Табличный грант любого вида перекрывает их и открывает phone, lat, lng,
  // phone_otp, stripe_customer_id.
  'public.users': {
    forbid: ALL_PRIVS,
    why: 'у users клиент получает только колоночные гранты (миграции 07, 14, 17): табличный перекрывает их и открывает phone, lat, lng, phone_otp, stripe_customer_id',
  },
  // Миграции 09 и 12: бронь заводит и переводит только сервер, под
  // service_role. Клиенту остаётся чтение.
  'public.bookings': {
    forbid: WRITE_PRIVS,
    why: 'бронь заводит (миграция 09) и переводит по статусам (миграция 12) только сервер под service_role; клиенту остаётся SELECT',
  },
}

/**
 * Убрать комментарии до разбора. Блочные — целиком, строчные — от `--` до
 * конца строки. Внутри строковых литералов `--` в этих миграциях не
 * встречается; появится — сторож увидит МЕНЬШЕ грантов, а не больше, и это
 * поймает проверка «сторож вообще что-то видит».
 */
export const stripComments = (sql) =>
  String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')

// GRANT/REVOKE … ON … TO/FROM … ; — по одному оператору, без учёта регистра.
// [\s\S]*? между ON и TO пропускает список таблиц, в том числе многострочный.
const STATEMENT = /\b(grant|revoke)\b([\s\S]*?)\bon\b([\s\S]*?)\b(?:to|from)\b([\s\S]*?);/gi

/**
 * Операторы выдачи и снятия прав из одного файла.
 *
 * Возвращает `{ kind, privs, columnLevel, objects, roles }`. Гранты на
 * функции, схемы, последовательности и `ALL TABLES IN SCHEMA` помечаются
 * `objectType`, чтобы вызывающий решал сам: молча пропускать неизвестную
 * форму — это дыра, которую не видно.
 */
export const parseStatements = (sql) => {
  const out = []
  const text = stripComments(sql)
  for (const m of text.matchAll(STATEMENT)) {
    const [, kindRaw, privsRaw, objectRaw, rolesRaw] = m
    const object = objectRaw.trim().replace(/\s+/g, ' ')

    let objectType = 'table'
    if (/^function\b/i.test(object)) objectType = 'function'
    else if (/^schema\b/i.test(object)) objectType = 'schema'
    else if (/^sequence\b/i.test(object)) objectType = 'sequence'
    else if (/^all\b/i.test(object)) objectType = 'all-in-schema'

    // Колоночный грант: `GRANT SELECT (a, b) ON …`. Скобки в списке
    // привилегий — единственный признак; они же отличают его от табличного.
    const columnLevel = /\(/.test(privsRaw)

    const privs = privsRaw
      .replace(/\([\s\S]*?\)/g, '')
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)

    const objects = object
      .replace(/^table\s+/i, '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .map((t) => (t.includes('.') ? t : `public.${t}`))

    const roles = rolesRaw
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)

    out.push({ kind: kindRaw.toLowerCase(), privs, columnLevel, objectType, objects, roles })
  }
  return out
}

/** Файлы миграций в том порядке, в каком их применяет `supabase db push`. */
export const migrationFiles = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()

/**
 * Проиграть все миграции по порядку и вернуть ИТОГОВЫЕ табличные привилегии
 * клиентских ролей: `Map<'role|public.table', Set<PRIV>>`.
 *
 * Колоночные гранты в состояние не попадают намеренно: правило говорит о
 * табличных, а колоночные — законный способ выдать доступ к безопасной части
 * users. `GRANT ALL` разворачивается в полный список: иначе `REVOKE SELECT`
 * следом не нашёл бы что снимать.
 */
export const replayGrants = (files = migrationFiles().map((f) => ({
  name: f,
  sql: readFileSync(join(MIGRATIONS, f), 'utf8'),
}))) => {
  const state = new Map()
  const unsupported = []

  for (const { name, sql } of files) {
    for (const st of parseStatements(sql)) {
      if (st.objectType === 'function' || st.objectType === 'schema' || st.objectType === 'sequence') continue
      if (st.objectType === 'all-in-schema') {
        if (st.roles.some((r) => CLIENT_ROLES.includes(r))) unsupported.push(`${name}: ${st.kind} … ON ALL … клиентской роли — форма, которую сторож не разбирает`)
        continue
      }
      if (st.columnLevel) continue

      const privs = st.privs.includes('ALL') || st.privs.includes('ALL PRIVILEGES') ? ALL_PRIVS : st.privs

      for (const role of st.roles) {
        if (!CLIENT_ROLES.includes(role)) continue
        for (const table of st.objects) {
          const key = `${role}|${table}`
          const set = state.get(key) ?? new Set()
          for (const p of privs) {
            if (st.kind === 'grant') set.add(p)
            else set.delete(p)
          }
          if (set.size) state.set(key, set)
          else state.delete(key)
        }
      }
    }
  }

  return { state, unsupported }
}

/**
 * Нарушения правил в итоговом состоянии. Пусто = после всех миграций
 * клиентские роли не держат ни одной запрещённой привилегии.
 */
export const findViolations = (files) => {
  const { state, unsupported } = replayGrants(files)
  const hits = [...unsupported]

  for (const [key, privs] of state) {
    const [role, table] = key.split('|')
    const rule = RULES[table]
    if (!rule) continue
    const bad = rule.forbid.filter((p) => privs.has(p)).sort()
    if (bad.length) hits.push(`${table}: роль ${role} держит ${bad.join(', ')} — ${rule.why}`)
  }

  return hits.sort()
}

/**
 * Сколько операторов сторож разобрал. Ноль или неправдоподобно мало —
 * значит разбор сломан, а зелёный результат ничего не значит.
 */
export const countStatements = () =>
  migrationFiles().reduce(
    (n, f) => n + parseStatements(readFileSync(join(MIGRATIONS, f), 'utf8')).length,
    0,
  )

if (process.argv[1] && process.argv[1].endsWith('check-migration-grants.mjs')) {
  const violations = findViolations()
  const { state } = replayGrants()
  const watched = Object.keys(RULES)
    .flatMap((t) => CLIENT_ROLES.map((r) => [t, r, state.get(`${r}|${t}`)]))
    .filter(([, , privs]) => privs?.size)
    .map(([t, r, privs]) => `  ${t} / ${r}: ${[...privs].sort().join(', ')}`)

  console.log(`миграций: ${migrationFiles().length}, операторов GRANT/REVOKE: ${countStatements()}`)
  console.log(watched.length ? `табличные права клиента на поднадзорных таблицах:\n${watched.join('\n')}` : 'табличных прав клиента на поднадзорных таблицах нет')
  for (const v of violations) console.log(`ЗАПРЕЩЕНО  ${v}`)
  if (violations.length) {
    console.log('\nСнять новой миграцией (REVOKE), а не правкой уже применённой.')
    console.log('Если решение осознанное — менять RULES в этом файле вместе с ADR.')
  }
  console.log(violations.length === 0
    ? 'клиентские роли запрещённых привилегий не держат'
    : `${violations.length} нарушений`)
  process.exit(violations.length ? 1 : 0)
}
