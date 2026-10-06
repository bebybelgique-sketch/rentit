-- Дневные счётчики (миграция 62) на живой базе. Всё внутри блока и
-- откатывается: блок кончается RAISE EXCEPTION с отчётом в тексте.
--
-- Запуск: npx supabase db query --linked -f supabase/tests/usage_counts.sql
--
-- Ждём в отчёте:
--   counted=+2 bad_event=rejected anon_select=denied anon_update=denied
--   authenticated_select=denied
DO $test$
DECLARE
  before_n integer;
  after_n  integer;
  r        text := '';
BEGIN
  SELECT coalesce(max(count), 0) INTO before_n
    FROM public.usage_counts WHERE day = current_date AND event = 'home_view';

  SET LOCAL ROLE anon;
  PERFORM public.count_usage('home_view');
  PERFORM public.count_usage('home_view');

  BEGIN
    PERFORM public.count_usage('drop_table');
    r := r || ' bad_event=ACCEPTED';
  EXCEPTION WHEN check_violation THEN
    r := r || ' bad_event=rejected';
  END;

  BEGIN
    PERFORM 1 FROM public.usage_counts LIMIT 1;
    r := r || ' anon_select=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' anon_select=denied';
  END;

  BEGIN
    UPDATE public.usage_counts SET count = 1000000;
    r := r || ' anon_update=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' anon_update=denied';
  END;

  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM 1 FROM public.usage_counts LIMIT 1;
    r := r || ' authenticated_select=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || ' authenticated_select=denied';
  END;

  RESET ROLE;
  SELECT count INTO after_n
    FROM public.usage_counts WHERE day = current_date AND event = 'home_view';
  r := ' counted=+' || (after_n - before_n) || r;

  RAISE EXCEPTION 'REPORT:%', r;
END
$test$;
