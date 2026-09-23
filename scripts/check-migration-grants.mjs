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
// ЧЕГО СТОРОЖ НЕ ЗНАЕТ — ЧИТАТЬ ПРЕЖДЕ, ЧЕМ ВЕРИТЬ ЗЕЛЁНОМУ.
//
// 1. Что применено на живой базе. Миграции здесь применяют руками (см.
//    docs/sprint-1-dod.md), файл в репозитории говорит о НАМЕРЕНИИ.
//
// 2. УМОЛЧАНИЯ SUPABASE — ЗАКРЫТО 19.09.2026, читать ниже. В схеме public стоит
//    `alter default privileges … grant all on tables to anon, authenticated`.
//    Значит базовое состояние НОВОЙ таблицы не «прав нет», а «права есть
//    ВСЕ», и ни одной строки об этом в миграциях не появляется. Сторож
//    проигрывает только написанное, поэтому такую таблицу он считает чистой.
//
//    Так и случилось 18.09.2026 с public.tool_demands: миграция 34 выдала ей
//    `grant insert` и была уверена, что этим ограничила клиента. Сторож
//    согласился. Живая база ответила иначе: GET → 200, PATCH → 204,
//    DELETE → 204. Права пришли из умолчаний, RLS просто не отдавал строк.
//
//    ВЫВОД ДЛЯ АВТОРА МИГРАЦИИ: у новой таблицы первым оператором идёт
//    `revoke all … from anon, authenticated`, и только потом нужный grant.
//    Без этого «сузил права» — иллюзия.
//
//    КАК ЗАКРЫТО. Сторож сам ЗАСЕИВАЕТ каждую встреченную `create table … `
//    в схеме public полным набором прав для anon и authenticated — тем
//    самым состоянием, которое создаёт умолчание. Дальше проигрываются
//    написанные grant и revoke. Итог совпал со ВСЕМИ живыми замерами
//    18.09 (docs/table-privileges-2026-09-18.md): bookings/users/reviews
//    отдают DELETE, users не отдаёт табличный SELECT, tool_demands держит
//    только INSERT. То есть модель воспроизводит живую базу, а не намерение.
//
//    Гейт, у которого известна слепая зона, обязан либо её закрыть, либо
//    считаться непройденным. Эта закрыта.
//
// 3. ХРАПОВИК ВМЕСТО ЗАПРЕТА — почему гейт зелёный, хотя дыры есть.
//    Засев вскрыл то, что было всегда: семь таблиц отдают клиенту ВСЁ, а
//    users и bookings держат привилегии, прямо запрещённые правилами ниже.
//    Снять их одним махом нельзя: массовый revoke трогает весь клиентский
//    путь сразу, и ошибка в одной строке ломает продукт целиком — перед
//    каждой снимаемой привилегией нужно назвать место в коде, которое ею
//    не пользуется. Поэтому сегодняшняя явь ЗАМОРОЖЕНА поимённо в
//    scripts/migration-grants-allowlist.json, и сторож падает на любом
//    отличии в ЛЮБУЮ сторону: появилась привилегия, которой вчера не было,
//    — красный; привилегию сняли, а строка осталась — тоже красный, иначе
//    список тихо разойдётся с явью и врать начнёт он.
//    Долги при этом печатаются и считаются каждый запуск. Список сокращают
//    миграциями; расти он не должен.
//
// Зелёный сторож означает «намерение в миграциях непротиворечиво», а не
// «на проде затянуто». Второе проверяется запросом к живой базе — образцы
// в шапках миграций 33 и 36.

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
  // Миграции 34 и 36: список названного спроса — то, что люди сказали
  // продукту, а не друг другу. Клиент его только пополняет.
  'public.tool_demands': {
    forbid: ['SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'],
    why: 'список названного спроса клиент только пополняет: читает его service_role (миграция 36)',
  },
  // Миграция 40: адрес подписки — это ключ, по которому человеку можно
  // слать сообщения. Пишет и читает только функция push-subscription.
  'public.push_subscriptions': {
    forbid: ALL_PRIVS,
    why: 'подписки на push пишет и читает только функция push-subscription под service_role (миграция 40): адрес подписки — ключ к уведомлениям человека',
  },
  // Миграция 40: отметка «уведомление ушло». Проставленная клиентом, она
  // глушила бы уведомления о чужих сообщениях.
  'public.push_sent': {
    forbid: ALL_PRIVS,
    why: 'отметки об отправленных уведомлениях ставит только service_role (миграция 40)',
  },
  'public.client_errors': {
    forbid: ALL_PRIVS,
    why: 'отчёты о поломках пишет только report-error, читает только admin-action — оба service_role (миграция 41)',
  },
  // Миграция 42: ленту пишут только функции (service_role). Клиенту —
  // чтение своего и КОЛОНОЧНЫЙ UPDATE (read_at): отметить прочитанным.
  // Табличный UPDATE открыл бы kind и booking_id — то есть подделку ленты.
  'public.notifications': {
    forbid: WRITE_PRIVS,
    why: 'ленту событий пишут только notify-rental и notify-message под service_role (миграция 42); клиенту — SELECT и колоночный UPDATE (read_at)',
  },
}

/**
 * Убрать комментарии до разбора. Блочные — целиком, строчные — от `--` до
 * конца строки. Внутри строковых литералов `--` в этих миграциях не
 * встречается; появится — сторож увидит МЕНЬШЕ грантов, а не больше, и это
 * поймает проверка «сторож вообще что-то видит».
 */
/**
 * Таблицы схемы public, создаваемые в этом файле.
 *
 * Нужны ради умолчания Supabase: новая таблица рождается с ПОЛНЫМ набором
 * прав у anon и authenticated, и ни одной строки об этом в миграциях нет.
 * Без засева сторож считает такую таблицу чистой — ровно так он и согласился
 * с миграцией 34, пока живая база не ответила иначе.
 */
const CREATE_TABLE = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9."]+)/gi

export const createdTables = (sql) => {
  const out = []
  for (const m of stripComments(sql).matchAll(CREATE_TABLE)) {
    const name = m[1].toLowerCase().replace(/"/g, '')
    const table = name.includes('.') ? name : `public.${name}`
    if (table.startsWith('public.')) out.push(table)
  }
  return out
}

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

/**
 * Имя, которое `supabase db push` СОГЛАСЕН применить: `<timestamp>_name.sql`.
 *
 * Всё остальное CLI пропускает, говоря об этом вслух на каждом запуске:
 *
 *   Skipping migration add_events_table.sql...
 *   (file name must match pattern "<timestamp>_name.sql")
 *
 * Сторож обязан пропускать ровно то же. Иначе он моделирует базу, которой
 * не существует: 19.09.2026 он засеивал public.events из файла, который
 * не применялся ни разу, и отчитывался о привилегиях выдуманной таблицы.
 */
const APPLIED_NAME = /^\d+_.+\.sql$/

/** Файлы миграций в том порядке, в каком их применяет `supabase db push`. */
export const migrationFiles = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && APPLIED_NAME.test(f))
    .sort()

/**
 * Файлы .sql, которые лежат рядом, но применены НЕ БУДУТ.
 *
 * Возвращаются отдельно, чтобы сторож сказал о них вслух. Молчание здесь
 * опаснее всего: файл выглядит миграцией, читается как миграция, и по нему
 * судят о состоянии базы — а он не исполнялся никогда. Именно так вышло с
 * public.events: таблица на проде ЕСТЬ (её завели руками), но из миграций
 * не воспроизводится, и в чистой базе её не будет.
 */
export const skippedFiles = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !APPLIED_NAME.test(f))
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
    // ЗАСЕВ идёт ПЕРЕД операторами этого же файла: `create table` и
    // `revoke all` обычно стоят в одной миграции, и порядок здесь решает.
    for (const table of createdTables(sql)) {
      for (const role of CLIENT_ROLES) {
        const key = `${role}|${table}`
        const set = state.get(key) ?? new Set()
        for (const p of ALL_PRIVS) set.add(p)
        state.set(key, set)
      }
    }

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
 * Храповик: замороженная поимённо ЯВЬ, а не идеал.
 *
 * RULES выше говорит «этого не должно быть НИКОГДА» и покрывает три таблицы,
 * по которым решение принято и записано. Остальные шесть до 19.09.2026 не
 * смотрел никто: засев умолчаний показал, что клиент держит на них полный
 * набор прав, и вырасти он мог бы молча — ни правила, ни теста.
 *
 * Поэтому здесь заморожена вся поверхность целиком, и сверка идёт в ОБЕ
 * стороны. Только «не больше» недостаточно: список, из которого не убирают
 * снятое, за полгода превращается в художественное произведение, и врать
 * начинает он, а не миграции.
 */
export const loadAllowlist = () =>
  JSON.parse(readFileSync(join(root, 'scripts', 'migration-grants-allowlist.json'), 'utf8')).tables

/**
 * Расхождения состояния со списком: `{ appeared, vanished }`.
 *
 * `appeared` — привилегия есть в миграциях, в списке её нет. Кто-то выдал
 * право и не сказал об этом.
 * `vanished` — привилегия в списке есть, в миграциях её больше нет. Право
 * сняли — строку надо убрать, иначе список расходится с явью.
 */
export const auditRatchet = (files, allowlist = loadAllowlist()) => {
  const { state } = replayGrants(files)
  const appeared = []
  const vanished = []

  const held = (table, role) => [...(state.get(`${role}|${table}`) ?? [])]
  const listed = (table, role) => (allowlist[table]?.[role] ?? [])

  const tables = new Set([
    ...Object.keys(allowlist),
    ...[...state.keys()].map((k) => k.split('|')[1]),
  ])

  for (const table of [...tables].sort()) {
    for (const role of CLIENT_ROLES) {
      const now = held(table, role)
      const was = listed(table, role)
      const plus = now.filter((p) => !was.includes(p)).sort()
      const minus = was.filter((p) => !now.includes(p)).sort()
      if (plus.length) appeared.push(`${table} / ${role}: ${plus.join(', ')} — выдано, но в списке этого нет`)
      if (minus.length) vanished.push(`${table} / ${role}: ${minus.join(', ')} — снято миграцией, убрать строку из списка`)
    }
  }

  return { appeared, vanished }
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
  const { appeared, vanished } = auditRatchet()
  const { state } = replayGrants()

  const surface = [...state.keys()]
    .sort()
    .filter((k) => state.get(k)?.size)
    .map((k) => {
      const [role, table] = k.split('|')
      return `  ${table} / ${role}: ${[...state.get(k)].sort().join(', ')}`
    })

  console.log(`миграций: ${migrationFiles().length}, операторов GRANT/REVOKE: ${countStatements()}`)

  // О пропущенных файлах говорится ВСЛУХ и первым делом. Файл, который
  // выглядит миграцией и не исполняется, опаснее отсутствующего: по нему
  // судят о состоянии базы.
  const skipped = skippedFiles()
  if (skipped.length) {
    console.log(`\nНЕ ПРИМЕНЯЮТСЯ (имя не по шаблону <timestamp>_name.sql, db push их пропускает):`)
    for (const f of skipped) console.log(`  ${f}`)
    console.log('  Состояние базы по ним судить НЕЛЬЗЯ.')
  }

  console.log(`\nтабличные права клиента после всех миграций:\n${surface.join('\n') || '  нет ни одной'}`)

  for (const v of violations) console.log(`\nЗАПРЕЩЕНО  ${v}`)
  for (const a of appeared) console.log(`\nНОВОЕ ПРАВО  ${a}`)
  for (const v of vanished) console.log(`\nСПИСОК УСТАРЕЛ  ${v}`)

  const total = violations.length + appeared.length + vanished.length
  if (total) {
    console.log('\nПривилегию снимают НОВОЙ миграцией (REVOKE), а не правкой уже применённой.')
    console.log('Если выдача осознанная — вписать строку в scripts/migration-grants-allowlist.json')
    console.log('вместе с пояснением why; запрет из RULES меняют только вместе с ADR.')
  }
  console.log(total === 0
    ? '\nповерхность совпадает со списком, запрещённых привилегий нет'
    : `\n${total} расхождений`)
  process.exit(total ? 1 : 0)
}
