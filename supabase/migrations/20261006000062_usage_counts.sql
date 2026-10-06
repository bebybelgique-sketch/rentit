-- 62. Дневные счётчики использования: день, событие, число.
--
-- ЗАЧЕМ. 06.10 первый экран развёрнут к поиску (#170), а сколько людей
-- открывает главную, ищет, упирается в пустую выдачу и начинает
-- выкладку — не известно никому: в продукте нет ни одного счётчика.
-- Без знаменателя «упираемся в трафик» остаётся выводом, а не замером.
-- Пункт 8 аудита: «не разворачивать аналитический фреймворк».
--
-- ЧТО ХРАНИТСЯ — И ЧЕГО НЕТ.
--   Хранится: день (UTC — часы базы), имя события из списка ниже, число.
--   НЕТ: кто это был (ни user_id, ни IP, ни строки браузера), адреса
--   страницы, текста поиска. Строка — сумма за день, разобрать её на
--   людей нельзя по построению.
--
-- ТОЛЬКО С СОГЛАСИЕМ. Баннер спрашивает «Analytique — Statistiques
-- anonymes d'utilisation». Клиент (src/lib/usage.ts) шлёт событие, только
-- если человек это включил; отказавшийся не считается. Цифры поэтому —
-- о согласившихся, а не обо всех.
--
-- НАКРУТКА. Функция открыта анониму — иначе не посчитать посетителя до
-- входа, — значит прибавить может кто угодно. Цена ошибки — неверное
-- число, а не утечка; скачок виден глазами в /admin. Потолка нет:
-- строк всё равно не больше шести в день.
--
-- СРОКА ХРАНЕНИЯ НЕТ. Это суммы без единого личного поля, ряд нужен
-- целиком, чтобы видеть ход.

CREATE TABLE IF NOT EXISTS public.usage_counts (
  day   date    NOT NULL DEFAULT current_date,
  event text    NOT NULL CHECK (event IN (
          'home_view',      -- открыта главная
          'hero_search',    -- поиск или чип задачи с первого экрана
          'browse_view',    -- открыта витрина
          'browse_empty',   -- витрина хоть раз ответила пусто за этот заход
          'demand_sent',    -- отправлена форма «Quel outil cherchiez-vous ?»
          'listing_start'   -- открыта форма выкладки
        )),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, event)
);

-- Умолчания Supabase выдают новой таблице ВСЕ права для anon и
-- authenticated (docs/table-privileges-2026-09-18.md). Снимаем первым
-- делом: пишет только count_usage, читает только admin-action.
REVOKE ALL ON public.usage_counts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_counts TO service_role;

ALTER TABLE public.usage_counts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.usage_counts IS
  'Дневные суммы событий (день UTC, событие, число). Без user_id, IP, адреса, текста поиска. Пишет count_usage (клиент зовёт её только при согласии на аналитику), читает admin-action. Без срока: личного нет.';

-- Плюс один к событию за сегодня.
--
-- SECURITY DEFINER намеренно: у клиента нет прав на таблицу, и давать их
-- нельзя — табличный UPDATE позволил бы вписать любое число. Функция
-- умеет ровно одно: +1. Чужое имя события отклоняет CHECK таблицы
-- (23514 → PostgREST 400), список событий один — в таблице.
CREATE OR REPLACE FUNCTION public.count_usage(p_event text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.usage_counts (day, event, count)
  VALUES (current_date, p_event, 1)
  -- Два события одновременно: второе не падает, а прибавляется.
  ON CONFLICT (day, event)
  DO UPDATE SET count = public.usage_counts.count + 1;
$$;

REVOKE ALL ON FUNCTION public.count_usage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_usage(text) TO anon, authenticated, service_role;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ: supabase/tests/usage_counts.sql
-- (anon: +1 проходит, чужое событие отклонено, таблица не читается и не пишется).
