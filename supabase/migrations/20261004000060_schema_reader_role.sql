-- Роль schema_reader: сторож дрейфа схемы видит СТРУКТУРУ public, но не данные.
--
-- ЗАЧЕМ. .github/workflows/schema-drift.yml с 07.09 падал каждый понедельник,
-- не дойдя до сверки: ему нужен был личный токен Supabase (SUPABASE_ACCESS_TOKEN),
-- а такой токен управляет ВСЕМИ проектами учётки — удалить базу им тоже можно.
-- Класть его в секреты публичного репозитория, где тот же прогон делает
-- `npm ci`, никто не стал, и гейт четыре недели был красным шумом. Теперь
-- сторож ходит в базу этой ролью: `supabase gen types --db-url`.
--
-- ЧТО ЕЙ ВИДНО И ПОЧЕМУ ИМЕННО ТАК. Генератор типов (postgres-meta) показывает
-- таблицу и колонку, только если у роли есть на неё хоть какое-то право:
-- в его columns.sql стоит has_column_privilege(..., 'SELECT, INSERT, UPDATE,
-- REFERENCES'), в table.sql — то же для таблиц. Голый LOGIN дал бы пустую
-- схему, и сторож кричал бы о «дрейфе» на каждом прогоне. Из этих прав данные
-- не открывает только REFERENCES: оно разрешает ссылаться внешним ключом, а
-- создать таблицу роли негде (CREATE ни на одну схему ей не выдан), временная
-- же таблица ссылаться на постоянную не может. SELECT не выдаётся нигде —
-- поэтому закрыт и pg_stats с образцами значений.
--
-- Функции, перечисления и связи генератор читает из каталогов без проверки
-- прав, им грант не нужен.
--
-- ПАРОЛЬ — НЕ ЗДЕСЬ. Роль создаётся без пароля, то есть войти ею нельзя.
-- Пароль ставится на живой базе вне репозитория (SCRAM-хешем, открытый текст
-- в базу не попадает) и живёт только в секрете SCHEMA_READER_DB_URL.
--
-- Живая проверка границы: supabase/tests/schema_reader.sql.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'schema_reader') then
    create role schema_reader with login noinherit nosuperuser nocreatedb
      nocreaterole noreplication nobypassrls connection limit 2;
  end if;
end
$$;

alter role schema_reader set default_transaction_read_only = on;
alter role schema_reader set statement_timeout = '60s';

grant usage on schema public to schema_reader;
grant references on all tables in schema public to schema_reader;

-- Новые таблицы будущих миграций (их создаёт postgres через db push) роль
-- увидит сразу. Без этого первая же новая таблица дала бы ложный «дрейф».
alter default privileges for role postgres in schema public
  grant references on tables to schema_reader;
