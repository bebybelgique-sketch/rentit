-- =============================================
-- 52. Занятость: что проверяется и когда
-- =============================================
--
-- Две правки одного правила (источник — миграция 22, unavailable_days).
--
-- 1. ПЕРЕДАЧА НЕ ПРОВЕРЯЕТ ДАТЫ ЗАНОВО.
--
--    Триггер trg_check_availability стоит на BEFORE INSERT OR UPDATE и до
--    этой миграции пересчитывал занятость на ЛЮБОМ изменении живой брони.
--    Подтверждённая бронь свои даты уже держит, но если владелец после
--    подтверждения закрыл один из этих дней перерывом (или поднял зазор),
--    передача confirmed → active падала с «Item is not available»: бронь
--    застревала — ни выдать вещь, ни закрыть сделку штатно, только отмена.
--
--    Теперь бронь проверяется, когда она ЗАНИМАЕТ даты впервые: заявка
--    (INSERT), одобрение (из статуса, который даты не держит, в тот, что
--    держит) и смена дат или вещи. Переход внутри держащих статусов —
--    передача — и правка прочих полей живой брони ничего не пересчитывают.
--    Одобрение по-прежнему проверяется под блокировкой строки вещи
--    (миграция 48): гонка двух одобрений закрыта там же.
--
-- 2. ЗАЗОР ДЕЙСТВУЕТ И ПЕРЕД ЧУЖОЙ БРОНЬЮ.
--
--    buffer_days — дни после возврата, когда вещь сохнет, чистится,
--    заряжается (миграция 22). unavailable_days прибавлял зазор только к
--    концу СУЩЕСТВУЮЩИХ броней. Зазор НОВОЙ брони не проверял никто: при
--    зазоре 2 дня и брони с 10-го заявка, кончающаяся 9-го, проходила —
--    вещь возвращалась вечером 9-го и уходила утром 10-го без сушки.
--
--    Теперь след брони — [начало − зазор, конец + зазор]. Новая бронь
--    конфликтует, если её дни попадают в след чужой: конец + зазор ≥ чужое
--    начало ⇔ конец ≥ чужое начало − зазор. Зазор между двумя бронями
--    остаётся одним, а не двойным: со следом чужой сравниваются только
--    собственные дни новой. Календарь гостя (item_calendar) читает ту же
--    функцию — дни перед чужой бронью он теперь показывает занятыми, и
--    выбрать даты, которые сервер отвергнет, нельзя.
--
--    Перерыв владельца (item_blackouts) в зазор не попадает и бронь не
--    блокирует: подготовка вещи — его собственное дело.
--
-- ПРОВЕРКА — до выката DO-блоком с откатом на живой базе: передача при
-- перерыве, повторное одобрение, зазор перед и после чужой брони,
-- календарь.
-- =============================================

CREATE OR REPLACE FUNCTION public.unavailable_days(
  p_item_ids uuid[] DEFAULT NULL::uuid[],
  p_from date DEFAULT NULL::date,
  p_to date DEFAULT NULL::date,
  p_exclude_booking uuid DEFAULT NULL::uuid
)
RETURNS TABLE(item_id uuid, day date, reason text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    SELECT p_from AS d_from, LEAST(p_to, p_from + 366) AS d_to
    WHERE p_from IS NOT NULL AND p_to IS NOT NULL AND p_to >= p_from
  ),
  taken AS (
    -- След брони: зазор и после возврата, и перед выдачей (см. шапку, п. 2).
    SELECT b.item_id, d::date AS day
    FROM public.bookings b
    JOIN public.items i ON i.id = b.item_id
    CROSS JOIN bounds
    CROSS JOIN LATERAL generate_series(
      GREATEST(b.start_date - i.buffer_days, bounds.d_from)::timestamp,
      LEAST(b.end_date + i.buffer_days, bounds.d_to)::timestamp,
      interval '1 day'
    ) AS d
    WHERE b.status IN ('pending_payment', 'confirmed', 'active')
      AND (p_item_ids IS NULL OR b.item_id = ANY (p_item_ids))
      AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
  ),
  full_days AS (
    SELECT t.item_id, t.day, 'booked'::text AS reason
    FROM taken t
    JOIN public.items i ON i.id = t.item_id
    GROUP BY t.item_id, t.day, i.quantity
    HAVING count(*) >= i.quantity
  ),
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
$function$;

CREATE OR REPLACE FUNCTION public.check_item_availability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_earliest date;
BEGIN
  IF NEW.status NOT IN ('pending_approval', 'pending_payment', 'confirmed', 'active') THEN
    RETURN NEW;
  END IF;

  -- Бронь уже держит эти даты (см. шапку, п. 1): передача и правка прочих
  -- полей ничего не занимают заново.
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('pending_payment', 'confirmed', 'active')
     AND NEW.item_id = OLD.item_id
     AND NEW.start_date = OLD.start_date
     AND NEW.end_date = OLD.end_date THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM public.items WHERE id = NEW.item_id FOR UPDATE;
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
