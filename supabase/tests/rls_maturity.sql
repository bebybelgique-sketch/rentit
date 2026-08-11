-- Отрицательные проверки RLS на живой базе.
-- Всё создаётся внутри блока и гарантированно откатывается: блок
-- завершается RAISE EXCEPTION, в тексте которого лежит отчёт.
DO $test$
DECLARE
  v_orig     text := current_user;
  v_owner    uuid := gen_random_uuid();
  v_renter   uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_item     uuid := gen_random_uuid();
  v_booking  uuid := gen_random_uuid();
  v_open     uuid := gen_random_uuid();
  v_msg      uuid := gen_random_uuid();
  v_log      text := '';
  v_n        int;
  v_rating   numeric;
BEGIN
  ------------------------------------------------------------------
  -- Подготовка (от привилегированной роли)
  ------------------------------------------------------------------
  INSERT INTO auth.users (id, email) VALUES
    (v_owner,    'rls-owner-'    || v_owner    || '@test.local'),
    (v_renter,   'rls-renter-'   || v_renter   || '@test.local'),
    (v_stranger, 'rls-stranger-' || v_stranger || '@test.local');

  -- строку в public.users заводит триггер на auth.users, поэтому не INSERT
  INSERT INTO public.users (id, full_name) VALUES
    (v_owner, 'RLS Owner'), (v_renter, 'RLS Renter'), (v_stranger, 'RLS Stranger')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  INSERT INTO public.items (id, owner_id, title, description, category, condition,
                            price_per_day, deposit, photos, available)
  VALUES (v_item, v_owner, 'RLS test item', null, 'hand_tools', 'good', 10, 0, '[]'::jsonb, true);

  -- завершённая бронь (total_days — генерируемый столбец, его не задаём)
  INSERT INTO public.bookings (id, item_id, renter_id, start_date, end_date,
                               total_price, deposit_amount, platform_fee, insurance_amount, status)
  VALUES (v_booking, v_item, v_renter, current_date - 10, current_date - 8,
          30, 0, 0, 0, 'completed');

  -- незавершённая бронь того же арендатора
  INSERT INTO public.bookings (id, item_id, renter_id, start_date, end_date,
                               total_price, deposit_amount, platform_fee, insurance_amount, status)
  VALUES (v_open, v_item, v_renter, current_date + 30, current_date + 31,
          20, 0, 0, 0, 'confirmed');

  INSERT INTO public.booking_messages (id, booking_id, sender_id, body)
  VALUES (v_msg, v_booking, v_owner, 'On se voit a 18h');

  INSERT INTO public.booking_photos (booking_id, uploaded_by, phase, storage_path)
  VALUES (v_booking, v_owner, 'handover', v_booking || '/handover/a.jpg');

  ------------------------------------------------------------------
  -- 1. Посторонний не видит переписки и фотографий чужой брони
  ------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
                 json_build_object('sub', v_stranger, 'role', 'authenticated')::text);

  SELECT count(*) INTO v_n FROM public.booking_messages WHERE booking_id = v_booking;
  v_log := v_log || E'\n1a. посторонний видит сообщений: ' || v_n || ' (ожидалось 0) -> ' ||
           CASE WHEN v_n = 0 THEN 'OK' ELSE 'ПРОВАЛ' END;

  SELECT count(*) INTO v_n FROM public.booking_photos WHERE booking_id = v_booking;
  v_log := v_log || E'\n1b. посторонний видит фотографий: ' || v_n || ' (ожидалось 0) -> ' ||
           CASE WHEN v_n = 0 THEN 'OK' ELSE 'ПРОВАЛ' END;

  -- посторонний пытается написать в чужую бронь
  BEGIN
    INSERT INTO public.booking_messages (booking_id, sender_id, body)
    VALUES (v_booking, v_stranger, 'je suis la');
    v_log := v_log || E'\n1c. посторонний написал в чужую бронь -> ПРОВАЛ';
  EXCEPTION WHEN insufficient_privilege THEN
    v_log := v_log || E'\n1c. посторонний пишет в чужую бронь: отклонено -> OK';
  END;

  -- посторонний пытается оценить участника чужой сделки
  BEGIN
    INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
    VALUES (v_booking, v_stranger, v_owner, v_item, 'owner', 1);
    v_log := v_log || E'\n1d. посторонний оценил чужую сделку -> ПРОВАЛ';
  EXCEPTION WHEN insufficient_privilege THEN
    v_log := v_log || E'\n1d. посторонний оценивает чужую сделку: отклонено -> OK';
  END;

  ------------------------------------------------------------------
  -- 2. Участник видит своё
  ------------------------------------------------------------------
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
                 json_build_object('sub', v_renter, 'role', 'authenticated')::text);

  SELECT count(*) INTO v_n FROM public.booking_messages WHERE booking_id = v_booking;
  v_log := v_log || E'\n2a. арендатор видит сообщений: ' || v_n || ' (ожидалось 1) -> ' ||
           CASE WHEN v_n = 1 THEN 'OK' ELSE 'ПРОВАЛ' END;

  SELECT count(*) INTO v_n FROM public.booking_photos WHERE booking_id = v_booking;
  v_log := v_log || E'\n2b. арендатор видит фотографий: ' || v_n || ' (ожидалось 1) -> ' ||
           CASE WHEN v_n = 1 THEN 'OK' ELSE 'ПРОВАЛ' END;

  ------------------------------------------------------------------
  -- 3. Отзыв о себе не проходит
  ------------------------------------------------------------------
  BEGIN
    INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
    VALUES (v_booking, v_renter, v_renter, v_item, 'renter', 5);
    v_log := v_log || E'\n3. отзыв о себе прошёл -> ПРОВАЛ';
  EXCEPTION WHEN insufficient_privilege THEN
    v_log := v_log || E'\n3. отзыв о себе: отклонено -> OK';
  END;

  ------------------------------------------------------------------
  -- 4. Отзыв без завершённой брони не проходит
  ------------------------------------------------------------------
  BEGIN
    INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
    VALUES (v_open, v_renter, v_owner, v_item, 'owner', 5);
    v_log := v_log || E'\n4. отзыв по незавершённой броне прошёл -> ПРОВАЛ';
  EXCEPTION WHEN insufficient_privilege THEN
    v_log := v_log || E'\n4. отзыв по незавершённой броне: отклонено -> OK';
  END;

  ------------------------------------------------------------------
  -- 5. Арендатор не может выдать себя за владельца (тип не той стороны)
  ------------------------------------------------------------------
  BEGIN
    INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
    VALUES (v_booking, v_renter, v_owner, v_item, 'renter', 1);
    v_log := v_log || E'\n5. арендатор поставил отзыв типа renter -> ПРОВАЛ';
  EXCEPTION WHEN insufficient_privilege THEN
    v_log := v_log || E'\n5. арендатор ставит отзыв типа renter: отклонено -> OK';
  END;

  ------------------------------------------------------------------
  -- 6. Законный отзыв проходит и пересчитывает рейтинг
  ------------------------------------------------------------------
  INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
  VALUES (v_booking, v_renter, v_owner, v_item, 'owner', 4);
  v_log := v_log || E'\n6a. арендатор оценил владельца: прошло -> OK';

  -- 7. Повторный отзыв того же типа
  BEGIN
    INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
    VALUES (v_booking, v_renter, v_owner, v_item, 'owner', 1);
    v_log := v_log || E'\n7. второй отзыв того же типа прошёл -> ПРОВАЛ';
  EXCEPTION WHEN unique_violation THEN
    v_log := v_log || E'\n7. второй отзыв того же типа: отклонено -> OK';
  END;

  -- владелец оценивает арендатора
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
                 json_build_object('sub', v_owner, 'role', 'authenticated')::text);
  INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
  VALUES (v_booking, v_owner, v_renter, v_item, 'renter', 5);
  v_log := v_log || E'\n6b. владелец оценил арендатора: прошло -> OK';

  EXECUTE format('SET LOCAL ROLE %I', v_orig);

  SELECT rating_as_owner INTO v_rating FROM public.users WHERE id = v_owner;
  v_log := v_log || E'\n8a. rating_as_owner владельца: ' || coalesce(v_rating::text, 'NULL') ||
           ' (ожидалось 4.00) -> ' || CASE WHEN v_rating = 4 THEN 'OK' ELSE 'ПРОВАЛ' END;

  SELECT rating_as_renter INTO v_rating FROM public.users WHERE id = v_renter;
  v_log := v_log || E'\n8b. rating_as_renter арендатора: ' || coalesce(v_rating::text, 'NULL') ||
           ' (ожидалось 5.00) -> ' || CASE WHEN v_rating = 5 THEN 'OK' ELSE 'ПРОВАЛ' END;

  -- 9. Удаление единственного отзыва возвращает NULL
  DELETE FROM public.reviews WHERE booking_id = v_booking AND review_type = 'owner';
  SELECT rating_as_owner INTO v_rating FROM public.users WHERE id = v_owner;
  v_log := v_log || E'\n9. после удаления единственного отзыва rating_as_owner: ' ||
           coalesce(v_rating::text, 'NULL') || ' (ожидалось NULL) -> ' ||
           CASE WHEN v_rating IS NULL THEN 'OK' ELSE 'ПРОВАЛ' END;

  -- 10. Отзыв о вещи (существующий путь) всё ещё работает
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
                 json_build_object('sub', v_renter, 'role', 'authenticated')::text);
  INSERT INTO public.reviews (booking_id, from_user_id, to_user_id, item_id, review_type, rating)
  VALUES (v_booking, v_renter, v_owner, v_item, 'item', 5);
  v_log := v_log || E'\n10a. отзыв о вещи (прежний путь): прошло -> OK';

  EXECUTE format('SET LOCAL ROLE %I', v_orig);
  SELECT rating_as_owner INTO v_rating FROM public.users WHERE id = v_owner;
  v_log := v_log || E'\n10b. отзыв о вещи в рейтинг человека не попал: ' ||
           coalesce(v_rating::text, 'NULL') || ' -> ' ||
           CASE WHEN v_rating IS NULL THEN 'OK' ELSE 'ПРОВАЛ' END;

  RAISE EXCEPTION E'ОТЧЁТ ПРОВЕРОК RLS (данные откачены)%', v_log;
END
$test$;
