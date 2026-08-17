-- =============================================
-- RentIt: занятость считается В ОДНОМ МЕСТЕ
--
-- ЗАЧЕМ ЭТА МИГРАЦИЯ СУЩЕСТВУЕТ
--
-- Прокатчик заходит на площадку под своим именем, а у него двенадцать
-- одинаковых стульев. Двенадцатью объявлениями это не выкладывается —
-- значит без КОЛИЧЕСТВА ЕДИНИЦ он физически не заходит. Это не удобство,
-- это вход.
--
-- Количество переписывает само правило занятости: было «любое пересечение
-- дат = занято», стало «занято, когда на КАКОЙ-ТО ДЕНЬ разобраны ВСЕ
-- единицы». А правило это на 17.08.2026 записано ПЯТЬ раз:
--
--   1. триггер check_item_availability          (20260402000010)
--   2. items_busy_between — фильтр витрины      (20260811000013)
--   3. get_booked_dates — данные календаря      (20260402000010)
--   4. isBooked() в src/pages/ItemDetail.tsx    (браузер)
--   5. запрос conflict в request-rental         (edge-функция)
--
-- Они УЖЕ разошлись: (1) не считал занятым pending_payment, а (2) считал.
-- Пять правок одного правила подряд — это и есть сценарий тихих багов,
-- поэтому и количество, и блокировка дат, и зазор, и минимальный срок
-- делаются ОДНИМ проходом, а расчёт сводится в одну функцию.
--
-- ЧТО СТАНОВИТСЯ ИСТОЧНИКОМ ПРАВДЫ
--
--   public.unavailable_days(...)  — какие ДНИ вещь взять нельзя
--   public.item_earliest_start()  — с какого дня её вообще можно начать
--
-- Всё остальное обязано обращаться к ним и не считать самостоятельно:
-- items_busy_between, get_booked_dates, item_calendar и триггер — тонкие
-- обёртки. Приём тот же, что у `_shared/pricing.ts`: одна реализация,
-- остальные — вызовы, а не копии.
--
-- ПРИМЕНЯТЬ: npx supabase db query --linked < этот_файл.sql
-- НЕ `supabase db push`: schema_migrations пуста для всех миграций,
-- push попытается прогнать историю заново и сломает базу.
-- =============================================

-- ---------------------------------------------
-- 1. Свойства вещи, которых не было
--
-- quantity: сколько одинаковых единиц. По умолчанию 1 — ровно прежнее
--   поведение для всех существующих объявлений, ни одно не меняется.
--
-- buffer_days: зазор ПОСЛЕ возврата. Мойку надо просушить, палатку
--   проветрить. Зазор занимает единицу так же, как аренда: с точки зрения
--   доступности «в сушке» и «у арендатора» — одно и то же.
--
-- min_notice_days: за сколько дней предупреждать. В ДНЯХ, а не в часах,
--   как у Booqable: у нас бронь измеряется датами (start_date date), и
--   «за 36 часов» в дневной сетке означало бы то полтора дня, то два —
--   правило, которое владелец не сможет предсказать. Дни честнее сетки.
-- ---------------------------------------------

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS quantity        integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS buffer_days     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_notice_days integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  -- Верхние границы — не придирка. quantity участвует в HAVING count(*) >=
  -- quantity: миллион единиц означал бы «никогда не занято», и витрина
  -- показывала бы вещь всегда. Зазор и предупреждение ограничены сроком,
  -- за которым объявление проще снять.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_quantity_sane') THEN
    ALTER TABLE public.items ADD CONSTRAINT items_quantity_sane
      CHECK (quantity BETWEEN 1 AND 999);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_buffer_days_sane') THEN
    ALTER TABLE public.items ADD CONSTRAINT items_buffer_days_sane
      CHECK (buffer_days BETWEEN 0 AND 30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_min_notice_days_sane') THEN
    ALTER TABLE public.items ADD CONSTRAINT items_min_notice_days_sane
      CHECK (min_notice_days BETWEEN 0 AND 90);
  END IF;
END $$;

-- ---------------------------------------------
-- 2. Блокировка дат владельцем
--
-- До сих пор у владельца было ровно два состояния: «сдаю всегда» и
-- «объявление скрыто целиком» (available = false). Уехать на неделю,
-- не снимая объявление, было нельзя — и человек снимал его, а потом
-- забывал вернуть.
--
-- note НЕ показывается арендатору: «я в отпуске до 20-го» — это про
-- владельца, а не про вещь. Наружу через unavailable_days уходит один
-- факт: этот день недоступен. Тот же принцип, что у items_busy_between.
-- ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.item_blackouts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  note       text CHECK (note IS NULL OR length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_blackouts_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_item_blackouts_item_dates
  ON public.item_blackouts (item_id, start_date, end_date);

ALTER TABLE public.item_blackouts ENABLE ROW LEVEL SECURITY;

-- Владелец вещи — единственный, кто видит и правит свои перерывы.
-- Посторонний узнаёт о них только как о недоступном дне, без причины.
DROP POLICY IF EXISTS "Owners manage their blackouts" ON public.item_blackouts;
CREATE POLICY "Owners manage their blackouts" ON public.item_blackouts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_blackouts.item_id AND i.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_blackouts.item_id AND i.owner_id = auth.uid()
  ));

-- Политика решает «какие строки», грант — «есть ли доступ к таблице
-- вообще». Без гранта запрос падает раньше политики.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_blackouts TO authenticated;

-- Занятость спрашивают по вещи и по датам — этим и индексируем.
CREATE INDEX IF NOT EXISTS idx_bookings_item_status_dates
  ON public.bookings (item_id, status, start_date, end_date);

-- ---------------------------------------------
-- 3. ИСТОЧНИК ПРАВДЫ №1: какие дни вещь взять нельзя
--
-- Возвращает по строке на КАЖДЫЙ недоступный день, а не диапазоны. Так
-- пришлось сделать из-за количества: «две брони пересеклись» больше не
-- означает «занято». При двух единицах брони 1–3 и 5–7 пересекаются с
-- запросом 1–7, но ни один ДЕНЬ не разобран полностью, и вещь свободна.
-- Считать это диапазонами — значит считать неверно.
--
-- Причина (reason) нужна календарю: «réservé» и «indisponible» — разные
-- сообщения. Если день попадает под обе, побеждает перерыв владельца:
-- он решение человека, а не следствие чужой брони.
--
-- SECURITY DEFINER: политики на bookings пускают к броне только её
-- стороны, поэтому посторонний, выбирающий даты, своими глазами занятость
-- не увидит. Наружу отдаётся ровно один факт — «этот день недоступен», —
-- который и так публичен на странице вещи. Ни кто арендует, ни на какую
-- сумму, ни причина перерыва не раскрываются.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.unavailable_days(
  p_item_ids        uuid[] DEFAULT NULL,   -- NULL = все вещи (нужно витрине)
  p_from            date   DEFAULT NULL,
  p_to              date   DEFAULT NULL,
  p_exclude_booking uuid   DEFAULT NULL    -- бронь не должна мешать сама себе
)
RETURNS TABLE (item_id uuid, day date, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH bounds AS (
    -- Окно ограничено годом: функция открыта анониму, и без потолка любой
    -- запрос на тысячу лет разворачивался бы в generate_series построчно.
    SELECT p_from AS d_from, LEAST(p_to, p_from + 366) AS d_to
    WHERE p_from IS NOT NULL AND p_to IS NOT NULL AND p_to >= p_from
  ),
  -- Дни, в которые единица кем-то занята. Аренда плюс зазор после
  -- возврата: единица «в сушке» так же недоступна, как и выданная.
  taken AS (
    SELECT b.item_id, d::date AS day
    FROM public.bookings b
    JOIN public.items i ON i.id = b.item_id
    CROSS JOIN bounds
    CROSS JOIN LATERAL generate_series(
      GREATEST(b.start_date, bounds.d_from)::timestamp,
      LEAST(b.end_date + i.buffer_days, bounds.d_to)::timestamp,
      interval '1 day'
    ) AS d
    -- Список статусов живёт ЗДЕСЬ и больше нигде. Заявка
    -- (pending_approval) вещь не держит: на одни даты их может быть
    -- несколько, и владелец выбирает.
    WHERE b.status IN ('pending_payment', 'confirmed', 'active')
      AND (p_item_ids IS NULL OR b.item_id = ANY (p_item_ids))
      AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
  ),
  -- Занято — когда разобраны ВСЕ единицы. Это и есть то, ради чего
  -- переписан расчёт: при quantity = 3 две брони не мешают третьей.
  full_days AS (
    SELECT t.item_id, t.day, 'booked'::text AS reason
    FROM taken t
    JOIN public.items i ON i.id = t.item_id
    GROUP BY t.item_id, t.day, i.quantity
    HAVING count(*) >= i.quantity
  ),
  -- Перерыв владельца снимает вещь целиком, независимо от количества.
  blocked AS (
    SELECT bl.item_id, d::date AS day, 'blocked'::text AS reason
    FROM public.item_blackouts bl
    CROSS JOIN bounds
    CROSS JOIN LATERAL generate_series(
      GREATEST(bl.start_date, bounds.d_from)::timestamp,
      LEAST(bl.end_date, bounds.d_to)::timestamp,
      interval '1 day'
    ) AS d
    WHERE p_item_ids IS NULL OR bl.item_id = ANY (p_item_ids)
  )
  SELECT DISTINCT ON (u.item_id, u.day) u.item_id, u.day, u.reason
  FROM (
    SELECT * FROM full_days
    UNION ALL
    SELECT * FROM blocked
  ) u
  ORDER BY u.item_id, u.day, (u.reason = 'blocked') DESC;
$$;

GRANT EXECUTE ON FUNCTION public.unavailable_days(uuid[], date, date, uuid)
  TO anon, authenticated;

-- ---------------------------------------------
-- 4. ИСТОЧНИК ПРАВДЫ №2: с какого дня аренду вообще можно начать
--
-- Минимальный срок — правило НЕ про дни диапазона, а только про его
-- начало. Аренда на 10 дней со стартом через неделю не нарушает
-- «предупреждать за два дня», хотя первые два дня окна в неё не входят.
-- Поэтому это отдельная функция, а не ещё одна причина в unavailable_days:
-- разные правила разной формы, а не копии одного.
--
-- current_date считается в часовом поясе базы (UTC). Бельгия летом UTC+2,
-- то есть после 22:00 по-местному «сегодня» у базы ещё вчерашнее. Так же
-- ведёт себя проверка даты в request-rental (сравнение с UTC-датой) —
-- расхождения между ними нет, и это сознательно.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.item_earliest_start(p_item_id uuid)
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT current_date + i.min_notice_days
  FROM public.items i
  WHERE i.id = p_item_id;
$$;

GRANT EXECUTE ON FUNCTION public.item_earliest_start(uuid) TO anon, authenticated;

-- ---------------------------------------------
-- 5. Потребитель: календарь на странице вещи
--
-- Один вызов вместо трёх: недоступные дни, самый ранний старт и
-- количество единиц. Раньше браузер брал диапазоны через get_booked_dates
-- и считал попадание дня в диапазон САМ — пятое место с тем же правилом.
-- Теперь он получает готовый список дней и ничего не выводит.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.item_calendar(
  p_item_id uuid,
  p_from    date DEFAULT NULL,
  p_to      date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'earliest_start', public.item_earliest_start(p_item_id),
    'quantity',       (SELECT i.quantity FROM public.items i WHERE i.id = p_item_id),
    'days', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', u.day, 'reason', u.reason) ORDER BY u.day)
      FROM public.unavailable_days(
             ARRAY[p_item_id],
             COALESCE(p_from, current_date),
             COALESCE(p_to,   current_date + 365)
           ) u
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.item_calendar(uuid, date, date) TO anon, authenticated;

-- ---------------------------------------------
-- 6. Потребитель: фильтр витрины
--
-- Подпись сохранена — browse_items (20260812000016) вызывает её как
-- прежде и не меняется. Изменилось только то, ЧТО значит «занята»:
-- теперь это «есть день, когда взять нельзя», с учётом количества,
-- перерывов и зазора.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.items_busy_between(p_start date, p_end date)
RETURNS TABLE (item_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT u.item_id
  FROM public.unavailable_days(NULL, p_start, p_end) u;
$$;

GRANT EXECUTE ON FUNCTION public.items_busy_between(date, date) TO anon, authenticated;

-- ---------------------------------------------
-- 7. Совместимость: get_booked_dates
--
-- Функция остаётся объявленной, но своей логики больше не имеет: отдаёт
-- недоступные дни однодневными отрезками. Оставлена, а не удалена, из-за
-- страниц, открытых со старым бандлом в момент выкладки — сломать им
-- календарь на пару минут незачем. Новый код её НЕ использует: страница
-- вещи перешла на item_calendar.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.get_booked_dates(p_item_id uuid)
RETURNS TABLE (start_date date, end_date date)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT u.day, u.day
  FROM public.unavailable_days(ARRAY[p_item_id], current_date, current_date + 365) u
  ORDER BY u.day;
$$;

-- ---------------------------------------------
-- 8. Потребитель: запрет пересечений при записи брони
--
-- Две правки помимо количества.
--
-- ПЕРВАЯ, и это исправление живого дефекта. Проверка стояла на ЛЮБОЙ
-- INSERT или UPDATE, включая переходы в состояния, которые вещь не
-- держат. Отсюда следовало вот что: заявка A (pending_approval) на даты,
-- которые владелец затем подтвердил другому человеку (бронь B), больше
-- НЕ МОГЛА БЫТЬ ЗАКРЫТА — попытка перевести A в expired поднимала
-- исключение, потому что B пересекается с её датами. Заявка застревала
-- навсегда, и expire-bookings спотыкался о неё каждые полчаса. Теперь
-- проверяются только состояния, которые вещь действительно занимают;
-- отмена, отказ и истечение проходят всегда.
--
-- ВТОРАЯ: минимальный срок проверяется при СОЗДАНИИ или при переносе дат,
-- но не при каждом обновлении. Иначе владелец не смог бы одобрить заявку,
-- поданную три дня назад на завтра, — правило «предупреждать заранее»
-- относится к тому, кто бронирует, а не к тому, кто отвечает.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.check_item_availability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_earliest date;
BEGIN
  IF NEW.status NOT IN ('pending_approval', 'pending_payment', 'confirmed', 'active') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.unavailable_days(
      ARRAY[NEW.item_id], NEW.start_date, NEW.end_date, NEW.id
    )
  ) THEN
    RAISE EXCEPTION 'Item is not available for the selected dates';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    v_earliest := COALESCE(public.item_earliest_start(NEW.item_id), current_date);
    IF NEW.start_date < v_earliest THEN
      RAISE EXCEPTION 'Item requires advance notice: earliest start date is %', v_earliest;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Триггер уже объявлен (20260319000002) — пересоздавать его не нужно,
-- он ссылается на функцию по имени.

-- ---------------------------------------------
-- 9. Повторная заявка того же человека на те же даты
--
-- Правило ДРУГОЕ, чем занятость (оно про одного арендатора, а не про
-- вещь), но арифметика пересечения та же. Именно поэтому оно тоже здесь:
-- если оставить его в edge-функции запросом
-- `.lte('start_date', …).gte('end_date', …)`, в коде снова появится место,
-- где даты пересекают руками, — и следующая правка расчёта опять пройдёт
-- мимо одного из них. Пересечений в TypeScript больше нет ни одного, и
-- это стережёт `scripts/check-availability-single-source.mjs`.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.renter_has_pending_request(
  p_item_id   uuid,
  p_renter_id uuid,
  p_start     date,
  p_end       date
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.item_id   = p_item_id
      AND b.renter_id = p_renter_id
      AND b.status    = 'pending_approval'
      AND daterange(b.start_date, b.end_date, '[]')
          && daterange(p_start, p_end, '[]')
  );
$$;

GRANT EXECUTE ON FUNCTION public.renter_has_pending_request(uuid, uuid, date, date)
  TO authenticated;

-- ---------------------------------------------
-- 10. Заявки, которые после одобрения соседней стали неисполнимы
--
-- Одобрив одну заявку, `respond-to-request` отклонял ВСЕ остальные с
-- пересекающимися датами. С одной единицей это верно. С двенадцатью
-- стульями — прямой убыток: одобрил одну заявку и сам отказал одиннадцати
-- людям, хотя стулья свободны.
--
-- Правильный вопрос не «пересекаются ли даты», а «остались ли на эти дни
-- свободные единицы» — и его уже умеет задавать unavailable_days.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.unservable_pending_requests(
  p_item_id         uuid,
  p_exclude_booking uuid DEFAULT NULL
)
RETURNS TABLE (id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id
  FROM public.bookings b
  WHERE b.item_id = p_item_id
    AND b.status  = 'pending_approval'
    AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
    AND EXISTS (
      SELECT 1 FROM public.unavailable_days(ARRAY[p_item_id], b.start_date, b.end_date)
    );
$$;

GRANT EXECUTE ON FUNCTION public.unservable_pending_requests(uuid, uuid)
  TO authenticated, service_role;

-- =============================================
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — на живой базе, а не на вере:
--
--   -- 1. Столбцы на месте, умолчания не тронули существующие объявления:
--   SELECT count(*) AS всего,
--          count(*) FILTER (WHERE quantity = 1)        AS одна_единица,
--          count(*) FILTER (WHERE buffer_days = 0)     AS без_зазора,
--          count(*) FILTER (WHERE min_notice_days = 0) AS без_предупреждения
--     FROM public.items;   -- три последних обязаны равняться первому
--
--   -- 2. Количество действительно снимает блокировку. На вещи с двумя
--   --    единицами одна подтверждённая бронь НЕ делает день недоступным:
--   SELECT count(*) FROM public.unavailable_days(
--            ARRAY['<item_id>'::uuid], current_date, current_date + 30);
--
--   -- 3. Пустая база даёт пустой ответ, а не ошибку:
--   SELECT public.item_calendar('00000000-0000-0000-0000-000000000000');
-- =============================================
