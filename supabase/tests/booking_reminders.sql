-- Напоминания (миграция 57) на живой базе. Всё создаётся внутри блока и
-- откатывается: блок кончается RAISE EXCEPTION с отчётом в тексте.
--
-- Запуск: npx supabase db query --linked -f supabase/tests/booking_reminders.sql
--
-- Ждём в отчёте:
--   anon_exec=false auth_exec=false service_exec=true  kind_checks=1
--   request_due=1 request_not_due=0 request_repeat=0 request_rows=1
--   return_before_18=0 return_due=1 return_single_day=0 cross_kind_due=1 cross_kind_rows=2
--   unconfirmed_before_9=0 unconfirmed_due=1 unconfirmed_completed=0
--
-- Часы выбраны так, чтобы ошибка «час по UTC вместо Брюсселя» краснела:
-- 18:30 и 9:30 по Брюсселю — это 16:30–17:30 и 7:30–8:30 по UTC.
--   bogus_kind=denied
-- request_other и return/unconfirmed чужих броней — сколько живых броней
-- попало в окно у «сейчас», заданного тестом; на пустой базе 0.
DO $pf$
DECLARE
  r text := '';
  v_owner uuid := gen_random_uuid();
  v_renter uuid := gen_random_uuid();
  v_item_r uuid; v_item_t uuid; v_item_t2 uuid; v_item_u uuid; v_item_u2 uuid;
  b_r1 uuid; b_r2 uuid; b_r3 uuid; b_r4 uuid; b_t1 uuid; b_t2 uuid; b_u1 uuid; b_u2 uuid;
  n int; n2 int; n3 int;
  d date := current_date + 60;
  p_r timestamptz := now() + interval '3 days';
  at_d_1700 timestamptz := ((current_date + 60)::timestamp + time '17:00') AT TIME ZONE 'Europe/Brussels';
  at_d_1830 timestamptz := ((current_date + 60)::timestamp + time '18:30') AT TIME ZONE 'Europe/Brussels';
  at_t_next_0930 timestamptz := ((current_date + 62)::timestamp + time '09:30') AT TIME ZONE 'Europe/Brussels';
  at_u_0830 timestamptz := ((current_date + 83)::timestamp + time '08:30') AT TIME ZONE 'Europe/Brussels';
  at_u_0930 timestamptz := ((current_date + 83)::timestamp + time '09:30') AT TIME ZONE 'Europe/Brussels';
BEGIN

  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data) VALUES
    (v_owner, 'reminders-owner-' || v_owner || '@rentit-test.local', 'authenticated', 'authenticated', '{}'::jsonb),
    (v_renter, 'reminders-renter-' || v_renter || '@rentit-test.local', 'authenticated', 'authenticated', '{}'::jsonb);
  INSERT INTO public.items (owner_id, title, price_per_day, category, condition, photos, available)
  VALUES (v_owner, 'reminders r', 90, 'construction', 'good', '{}', true) RETURNING id INTO v_item_r;
  INSERT INTO public.items (owner_id, title, price_per_day, category, condition, photos, available)
  VALUES (v_owner, 'reminders t', 90, 'construction', 'good', '{}', true) RETURNING id INTO v_item_t;
  INSERT INTO public.items (owner_id, title, price_per_day, category, condition, photos, available)
  VALUES (v_owner, 'reminders t2', 90, 'construction', 'good', '{}', true) RETURNING id INTO v_item_t2;
  INSERT INTO public.items (owner_id, title, price_per_day, category, condition, photos, available)
  VALUES (v_owner, 'reminders u', 90, 'construction', 'good', '{}', true) RETURNING id INTO v_item_u;
  INSERT INTO public.items (owner_id, title, price_per_day, category, condition, photos, available)
  VALUES (v_owner, 'reminders u2', 90, 'construction', 'good', '{}', true) RETURNING id INTO v_item_u2;

  -- Права: только service_role.
  r := r || ' anon_exec=' || has_function_privilege('anon', 'public.queue_booking_reminders(timestamptz)', 'EXECUTE')
         || ' auth_exec=' || has_function_privilege('authenticated', 'public.queue_booking_reminders(timestamptz)', 'EXECUTE')
         || ' service_exec=' || has_function_privilege('service_role', 'public.queue_booking_reminders(timestamptz)', 'EXECUTE');

  -- Проверка видов одна: прежняя снята, новая знает напоминания.
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%expired_owner%';
  r := r || ' kind_checks=' || n;

  -- Заявка: 19 ч — пора; 17 ч — рано; 23 ч — окно закрыто; принятая — не заявка.
  BEGIN
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_r, v_renter, d + 10, d + 10, 90, 'pending_approval', p_r - interval '19 hours') RETURNING id INTO b_r1;
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_r, v_renter, d + 12, d + 12, 90, 'pending_approval', p_r - interval '17 hours') RETURNING id INTO b_r2;
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_r, v_renter, d + 14, d + 14, 90, 'pending_approval', p_r - interval '23 hours') RETURNING id INTO b_r3;
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_r, v_renter, d + 16, d + 16, 90, 'confirmed', p_r - interval '19 hours') RETURNING id INTO b_r4;
    SELECT count(*) FILTER (WHERE q.booking_id = b_r1 AND q.user_id = v_owner AND q.kind = 'request_reminder'),
           count(*) FILTER (WHERE q.booking_id IN (b_r2, b_r3, b_r4)),
           count(*) FILTER (WHERE q.booking_id NOT IN (b_r1, b_r2, b_r3, b_r4))
      INTO n, n2, n3 FROM public.queue_booking_reminders(p_r) q;
    r := r || ' request_due=' || n || ' request_not_due=' || n2 || ' request_other=' || n3;
    SELECT count(*) INTO n FROM public.queue_booking_reminders(p_r) q WHERE q.booking_id = b_r1;
    r := r || ' request_repeat=' || n;
    SELECT count(*) INTO n FROM public.notifications WHERE booking_id = b_r1 AND kind = 'request_reminder' AND user_id = v_owner;
    r := r || ' request_rows=' || n;
  EXCEPTION WHEN OTHERS THEN r := r || ' requests=FAIL:' || SQLERRM; END;

  -- Возврат завтра: до 18:00 рано; однодневная аренда — без напоминания.
  BEGIN
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_t, v_renter, d - 2, d + 1, 90, 'active', now()) RETURNING id INTO b_t1;
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_t2, v_renter, d + 1, d + 1, 90, 'active', now()) RETURNING id INTO b_t2;
    SELECT count(*) INTO n FROM public.queue_booking_reminders(at_d_1700) q WHERE q.booking_id IN (b_t1, b_t2);
    r := r || ' return_before_18=' || n;
    SELECT count(*) FILTER (WHERE q.booking_id = b_t1 AND q.user_id = v_renter AND q.kind = 'return_tomorrow'),
           count(*) FILTER (WHERE q.booking_id = b_t2)
      INTO n, n2 FROM public.queue_booking_reminders(at_d_1830) q;
    r := r || ' return_due=' || n || ' return_single_day=' || n2;
    -- Та же бронь на следующий день после конца: владельцу «не отмечен».
    -- Разные виды одной брони друг друга не гасят.
    SELECT count(*) INTO n FROM public.queue_booking_reminders(at_t_next_0930) q
     WHERE q.booking_id = b_t1 AND q.user_id = v_owner AND q.kind = 'return_unconfirmed';
    r := r || ' cross_kind_due=' || n;
    SELECT count(DISTINCT kind) INTO n FROM public.notifications
     WHERE booking_id = b_t1 AND kind IN ('return_tomorrow', 'return_unconfirmed');
    r := r || ' cross_kind_rows=' || n;
  EXCEPTION WHEN OTHERS THEN r := r || ' return=FAIL:' || SQLERRM; END;

  -- Возврат не отмечен: до 9:00 рано; завершённая бронь — без напоминания.
  BEGIN
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_u, v_renter, d + 20, d + 22, 90, 'active', now()) RETURNING id INTO b_u1;
    INSERT INTO public.bookings (item_id, renter_id, start_date, end_date, total_price, status, created_at)
    VALUES (v_item_u2, v_renter, d + 20, d + 22, 90, 'completed', now()) RETURNING id INTO b_u2;
    SELECT count(*) INTO n FROM public.queue_booking_reminders(at_u_0830) q WHERE q.booking_id IN (b_u1, b_u2);
    r := r || ' unconfirmed_before_9=' || n;
    SELECT count(*) FILTER (WHERE q.booking_id = b_u1 AND q.user_id = v_owner AND q.kind = 'return_unconfirmed'),
           count(*) FILTER (WHERE q.booking_id = b_u2)
      INTO n, n2 FROM public.queue_booking_reminders(at_u_0930) q;
    r := r || ' unconfirmed_due=' || n || ' unconfirmed_completed=' || n2;
  EXCEPTION WHEN OTHERS THEN r := r || ' unconfirmed=FAIL:' || SQLERRM; END;

  -- Чужой вид по-прежнему отвергается.
  BEGIN
    INSERT INTO public.notifications (user_id, kind, booking_id) VALUES (v_owner, 'bogus', b_r1);
    r := r || ' bogus_kind=ALLOWED';
  EXCEPTION WHEN check_violation THEN r := r || ' bogus_kind=denied';
            WHEN OTHERS THEN r := r || ' bogus_kind=FAIL:' || SQLERRM;
  END;

  RAISE EXCEPTION E'ОТЧЁТ НАПОМИНАНИЙ (данные откачены)%', r;
END
$pf$;
