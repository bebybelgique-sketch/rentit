-- =============================================
-- 48. Проверка занятости — по очереди на каждую вещь
-- =============================================
--
-- ДЫРА (аудит сервера 01.10). Триггер check_item_availability спрашивает
-- unavailable_days обычным SELECT. В READ COMMITTED он не видит
-- незафиксированную запись соседней транзакции. Две одновременные
-- транзакции, подтверждающие РАЗНЫЕ заявки на одни даты одной вещи
-- (две вкладки владельца, быстрые клики, одобрение одновременно с
-- выдачей), видят соседа ещё в pending_approval — тот занятость не
-- держит — и обе ставят confirmed. Итог: одна единица выдана дважды.
-- Условный UPDATE в функциях от этого не спасает: он сторожит СВОЮ бронь,
-- а гонка — между двумя разными.
--
-- ПРАВКА. Перед проверкой триггер берёт блокировку строки вещи
-- (SELECT … FOR UPDATE). Вторая транзакция ждёт, пока первая завершится,
-- и её проверка уже видит подтверждённую бронь соседа: исключение, второе
-- одобрение отклоняется. Блокировка берётся только для удерживающих
-- статусов: отказ, отмена, истечение и завершение никого не ждут.
--
-- Взаимной блокировки нет: каждая запись брони в этом продукте — отдельный
-- запрос PostgREST из edge-функции, то есть транзакция из ОДНОГО оператора.
-- Она держит строку брони и строку вещи считанные миллисекунды и
-- освобождает обе на фиксации; держать одну и ждать другую в рамках
-- многошаговой транзакции здесь некому. Правка вещи (UPDATE items) брони не
-- трогает.
--
-- Тело — итоговая версия из миграции 22 (сверено с живой базой 01.10:
-- pg_get_functiondef), добавлена одна строка блокировки.
-- =============================================

CREATE OR REPLACE FUNCTION public.check_item_availability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_earliest date;
BEGIN
  IF NEW.status NOT IN ('pending_approval', 'pending_payment', 'confirmed', 'active') THEN
    RETURN NEW;
  END IF;

  -- Очередь на вещь: соседняя транзакция по той же вещи ждёт здесь, и её
  -- проверка ниже увидит уже зафиксированный результат этой.
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
