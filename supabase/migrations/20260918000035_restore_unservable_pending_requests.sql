-- =============================================
-- Миграция 35: возвращена функция, которой нет на проде, хотя её объявили
-- =============================================
--
-- ЧТО СЛУЧИЛОСЬ. `unservable_pending_requests` объявлена в миграции
-- 20260817000022 (раздел 10, строка 414). Миграция записана в журнал как
-- применённая целиком. Функции на проде НЕТ.
--
-- Проверено 17.09.2026 не по типам, а вызовом:
--   POST /rest/v1/rpc/unservable_pending_requests → 404 PGRST202
--   «Could not find the function public.unservable_pending_requests»
-- при том что соседняя из той же миграции отвечает 200:
--   POST /rest/v1/rpc/item_calendar → 200
-- `DROP FUNCTION` в миграции 22 нет ни одного. Значит она применилась
-- ЧАСТИЧНО, оборвавшись где-то после раздела с item_calendar, и всё равно
-- получила отметку «применена». Оттуда же отсутствует
-- check_item_availability — но её не вызывает никто, поэтому здесь её нет:
-- возвращать мёртвое ради симметрии значит чинить не то.
--
-- ЧЕМ ЭТО ОБЕРНУЛОСЬ. supabase/functions/respond-to-request/index.ts:197
-- зовёт эту функцию сразу после одобрения брони. Ошибка там проглатывается
-- НАМЕРЕННО и правильно: одобрение уже состоялось, и отменять его из-за
-- неудачной уборки соседних заявок нельзя — владелец получил бы отказ на
-- действие, которое прошло.
--
-- Цена этой правильности: отказ не виден никому, кроме журнала функции. А
-- `conflicting` приходит пустым, и заявки, которые после одобрения стало
-- невозможно исполнить, НЕ ОТКЛОНЯЮТСЯ НИКОГДА — висят у людей как живые.
-- Ровно то, что комментарий рядом с вызовом обещает не допустить.
--
-- Сегодня не проявляется только потому, что броней на проде ноль. Это не
-- смягчающее обстоятельство, а совпадение: дефект ждёт второй заявки на те
-- же даты.
--
-- ПОЧЕМУ ТЕЛО НЕ ИЗМЕНЕНО НИ НА СИМВОЛ. Дефект в том, что функции нет, а не
-- в том, что она неверна. Сверено с живой схемой: зависимость
-- `unavailable_days` на проде есть и её сигнатура совпадает с миграцией 22
-- дословно — (p_item_ids uuid[], p_from date, p_to date, p_exclude_booking
-- uuid), все со значениями по умолчанию, поэтому позиционный вызов тремя
-- аргументами ниже законен.
--
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — вызовом, а не верой:
--   select proname, pronargs from pg_proc
--    where proname = 'unservable_pending_requests';
--   -- ожидается одна строка, pronargs = 2
-- И тем же запросом, что показал отсутствие:
--   POST /rest/v1/rpc/unservable_pending_requests {"p_item_id":"<uuid>"}
--   -- ожидается 200, а не 404 PGRST202
-- =============================================

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
