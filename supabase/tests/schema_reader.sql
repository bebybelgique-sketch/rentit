-- Граница роли schema_reader (миграция 60) на живой базе. Только чтение
-- каталогов; блок кончается RAISE EXCEPTION с отчётом в тексте.
--
-- Запуск: npx supabase db query --linked -f supabase/tests/schema_reader.sql
--
-- Ждём в отчёте:
--   login=t super=f bypassrls=f connlimit=2 readonly=on
--   data_rel=0 hidden_rel=0 exec_beyond_anon=0 create_schema=0 create_db=f pg_net=t
--
-- data_rel         — отношений, до которых роль ДОТЯНЕТСЯ (USAGE на схему) и где
--                    ей дан SELECT, INSERT, UPDATE, DELETE или TRUNCATE. Схема net
--                    не в счёт — она отдельным полем pg_net, см. ниже.
-- hidden_rel       — отношений public, которых генератор типов НЕ увидит (нет
--                    REFERENCES). Не 0 — сторож дрейфа соврёт «таблица пропала».
-- exec_beyond_anon — функций, которые роль может вызвать, а anon нет. Через
--                    PUBLIC она вызывает ровно то же, что любой аноним с ключом
--                    из бандла, и сверх этого ничего.
-- pg_net=t         — ИЗВЕСТНЫЙ ОСТАТОК, не цель. Supabase выдаёт схему net
--                    роли PUBLIC: любая роль со входом может слать HTTP из базы
--                    (net.http_post) и читать очередь и ответы pg_net. Отозвать
--                    право PUBLIC у одной роли Postgres не умеет. Если однажды
--                    станет f — остаток закрыт, обновить ожидание.
DO $test$
DECLARE
  r      record;
  n_data int;
  n_hid  int;
  n_exec int;
  n_csch int;
  ro     text;
BEGIN
  SELECT rolcanlogin, rolsuper, rolbypassrls, rolconnlimit
    INTO r FROM pg_roles WHERE rolname = 'schema_reader';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT: роли schema_reader нет';
  END IF;

  SELECT coalesce((
    SELECT split_part(c, '=', 2)
      FROM pg_db_role_setting s
      JOIN pg_roles ro ON ro.oid = s.setrole
      CROSS JOIN unnest(s.setconfig) c
     WHERE ro.rolname = 'schema_reader' AND s.setdatabase = 0
       AND c LIKE 'default_transaction_read_only=%'), 'unset')
    INTO ro;

  SELECT count(*) INTO n_data
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE c.relkind IN ('r', 'v', 'm', 'f', 'p')
     AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
     AND ns.nspname NOT LIKE 'pg_toast%'
     AND ns.nspname <> 'net'
     AND has_schema_privilege('schema_reader', ns.oid, 'USAGE')
     AND (has_table_privilege('schema_reader', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          OR has_any_column_privilege('schema_reader', c.oid, 'SELECT, INSERT, UPDATE'));

  SELECT count(*) INTO n_hid
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
     AND NOT has_table_privilege('schema_reader', c.oid, 'REFERENCES');

  SELECT count(*) INTO n_exec
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
     AND has_function_privilege('schema_reader', p.oid, 'EXECUTE')
     AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');

  SELECT count(*) INTO n_csch
    FROM pg_namespace ns
   WHERE has_schema_privilege('schema_reader', ns.oid, 'CREATE');

  RAISE EXCEPTION 'REPORT: login=% super=% bypassrls=% connlimit=% readonly=% data_rel=% hidden_rel=% exec_beyond_anon=% create_schema=% create_db=% pg_net=%',
    r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolconnlimit, ro,
    n_data, n_hid, n_exec, n_csch,
    has_database_privilege('schema_reader', current_database(), 'CREATE'),
    coalesce((SELECT has_schema_privilege('schema_reader', oid, 'USAGE')
                FROM pg_namespace WHERE nspname = 'net'), false);
END
$test$;
