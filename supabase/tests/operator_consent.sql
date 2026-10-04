-- Согласие владельца на работу с оператором (миграция 61) на живой базе.
-- Всё создаётся внутри блока и откатывается: блок кончается RAISE EXCEPTION
-- с отчётом в тексте.
--
-- Запуск: npx supabase db query --linked -f supabase/tests/operator_consent.sql
--
-- Ждём в отчёте:
--   forged=server same_version=kept old_client=2026-10-03/server
--   no_consent=rejected bad_version=rejected withdrawn=cleared
--
-- same_version проверяет, что правка без смены редакции дату не трогает.
-- Внутри одной транзакции now() один и тот же, поэтому прежнюю дату ставим
-- руками при выключенном триггере — ALTER TABLE откатывается вместе со всем.
DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_item  uuid;
  t1      timestamptz;
  v       text;
  r       text := '';
BEGIN
  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data) VALUES
    (v_owner, 'consent-' || v_owner || '@rentit-test.local', 'authenticated', 'authenticated', '{}'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- Клиент прислал свою дату — в базе серверная.
  INSERT INTO public.items (owner_id, title, price_per_day, operator_fee_per_day, operator_terms_accepted_at, operator_terms_version)
  VALUES (v_owner, 'Consent test', 10, 160, '2000-01-01', '2026-10-03')
  RETURNING id, operator_terms_accepted_at INTO v_item, t1;
  r := r || ' forged=' || CASE WHEN t1 = now() THEN 'server' ELSE 'CLIENT' END;

  -- Правка цены при той же редакции — дата согласия прежняя.
  RESET ROLE;
  ALTER TABLE public.items DISABLE TRIGGER items_stamp_operator_terms;
  UPDATE public.items SET operator_terms_accepted_at = '2001-01-01' WHERE id = v_item;
  ALTER TABLE public.items ENABLE TRIGGER items_stamp_operator_terms;
  SET LOCAL ROLE authenticated;
  UPDATE public.items SET operator_fee_per_day = 170, title = 'Consent test 2'
   WHERE id = v_item RETURNING operator_terms_accepted_at INTO t1;
  r := r || ' same_version=' || CASE WHEN t1 = '2001-01-01'::timestamptz THEN 'kept' ELSE 'RESTAMPED' END;

  -- Сборка до версий: метка без редакции — редакция подставлена, дата серверная.
  INSERT INTO public.items (owner_id, title, price_per_day, operator_fee_per_day, operator_terms_accepted_at)
  VALUES (v_owner, 'Consent old client', 10, 160, '2000-01-01')
  RETURNING operator_terms_version, operator_terms_accepted_at INTO v, t1;
  r := r || ' old_client=' || coalesce(v, 'null') || CASE WHEN t1 = now() THEN '/server' ELSE '/CLIENT' END;

  BEGIN
    INSERT INTO public.items (owner_id, title, price_per_day, operator_fee_per_day)
    VALUES (v_owner, 'No consent', 10, 160);
    r := r || ' no_consent=ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    r := r || ' no_consent=rejected';
  END;

  BEGIN
    INSERT INTO public.items (owner_id, title, price_per_day, operator_fee_per_day, operator_terms_version)
    VALUES (v_owner, 'Bad version', 10, 160, '1999-01-01');
    r := r || ' bad_version=ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    r := r || ' bad_version=rejected';
  END;

  -- Оператора сняли — согласие обнулено.
  UPDATE public.items SET operator_fee_per_day = NULL WHERE id = v_item
  RETURNING operator_terms_accepted_at, operator_terms_version INTO t1, v;
  r := r || ' withdrawn=' || CASE WHEN t1 IS NULL AND v IS NULL THEN 'cleared' ELSE 'KEPT' END;

  RAISE EXCEPTION 'REPORT:%', r;
END
$test$;
