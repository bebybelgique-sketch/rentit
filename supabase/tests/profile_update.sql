-- Сохранение профиля на живой базе. Всё создаётся внутри блока и
-- откатывается: блок кончается RAISE EXCEPTION с отчётом в тексте.
--
-- Запуск: npx supabase db query --linked -f supabase/tests/profile_update.sql
--
-- Ждём в отчёте:
--   own_name=ok own_avatar=ok own_village=ok
--   role=denied is_pro=denied referred_by=denied
--   other_row=0
--
-- ЗАЧЕМ. С 24.09 по 03.10 ни один вошедший человек не мог сохранить свой
-- профиль: политика UPDATE сверяла подзапросом колонку, которую ему
-- запретили читать (миграция 58). Сквозные проверки этого не видели — их
-- учётки давно с фото и именем. Этот тест проходит путь сохранения прямо.
DO $test$
DECLARE
  v_me    uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  r       text := '';
  n       int;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data) VALUES
    (v_me,    'profile-me-'    || v_me    || '@rentit-test.local', 'authenticated', 'authenticated', '{}'::jsonb),
    (v_other, 'profile-other-' || v_other || '@rentit-test.local', 'authenticated', 'authenticated', '{}'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_me, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- Свои поля, которые профиль и правда меняет.
  BEGIN UPDATE public.users SET full_name = 'Test Profil' WHERE id = v_me; r := r || ' own_name=ok';
  EXCEPTION WHEN OTHERS THEN r := r || ' own_name=FAIL:' || SQLSTATE || ':' || SQLERRM; END;
  BEGIN UPDATE public.users SET avatar_url = 'https://example.invalid/a.png' WHERE id = v_me; r := r || ' own_avatar=ok';
  EXCEPTION WHEN OTHERS THEN r := r || ' own_avatar=FAIL:' || SQLSTATE || ':' || SQLERRM; END;
  BEGIN UPDATE public.users SET village = 'Walhain' WHERE id = v_me; r := r || ' own_village=ok';
  EXCEPTION WHEN OTHERS THEN r := r || ' own_village=FAIL:' || SQLSTATE || ':' || SQLERRM; END;

  -- Закрытые поля: граница — колоночные права, а не политика.
  BEGIN UPDATE public.users SET role = 'admin' WHERE id = v_me; r := r || ' role=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN r := r || ' role=denied';
            WHEN OTHERS THEN r := r || ' role=FAIL:' || SQLSTATE; END;
  BEGIN UPDATE public.users SET is_pro = true WHERE id = v_me; r := r || ' is_pro=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN r := r || ' is_pro=denied';
            WHEN OTHERS THEN r := r || ' is_pro=FAIL:' || SQLSTATE; END;
  BEGIN UPDATE public.users SET referred_by = v_other WHERE id = v_me; r := r || ' referred_by=ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN r := r || ' referred_by=denied';
            WHEN OTHERS THEN r := r || ' referred_by=FAIL:' || SQLSTATE; END;

  -- Чужую строку политика не отдаёт: ноль затронутых строк.
  BEGIN
    UPDATE public.users SET full_name = 'Pirate' WHERE id = v_other;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || ' other_row=' || n;
  EXCEPTION WHEN OTHERS THEN r := r || ' other_row=FAIL:' || SQLSTATE || ':' || SQLERRM; END;

  RESET ROLE;
  RAISE EXCEPTION E'ОТЧЁТ ПРОФИЛЯ (данные откачены)%', r;
END
$test$;
