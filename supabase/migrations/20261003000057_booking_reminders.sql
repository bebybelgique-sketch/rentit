-- =============================================
-- 57. Напоминания: заявка без ответа, возврат завтра, возврат не отмечен
-- =============================================
--
-- ЗАЧЕМ. Заявка живёт сутки (expire-bookings), а владелец узнаёт о ней
-- один раз — в момент подачи. Не увидел push, не открыл приложение —
-- заявка сгорает молча. Это узкое место №1 продукта. Возврат тоже
-- держится на памяти сторон: арендатор забывает дату, владелец забывает
-- нажать «Marquer retourné». Тогда бронь закрывает таймер через неделю,
-- и до тех пор не открываются отзывы.
--
-- ЧТО И КОГДА. Время брюссельское, планировщик зовёт expire-bookings
-- каждые 30 минут:
--
--   request_reminder    владельцу   заявка ждёт от 18 до 22 часов
--   return_tomorrow     арендатору  аренда кончается завтра, с 18:00;
--                                   только многодневная
--   return_unconfirmed  владельцу   срок кончился вчера, бронь всё ещё
--                                   active, с 9:00
--
-- Условия заданы окнами, а не точками: если вызов планировщика пропал,
-- напоминание поставит следующий. Окно заявки кончается в 22 часа, а не
-- в 24: текст «сгорит через несколько часов» за пять минут до сгорания
-- был бы неправдой. Если окно пропущено целиком, напоминания нет.
--
-- ОДИН РАЗ. Напоминание — строка в той же таблице notifications с тем же
-- ограничением notifications_once (человек, вид, бронь). Повторный вызов
-- в том же окне ничего не вставит. Функция возвращает ТОЛЬКО строки,
-- вставленные сейчас, и expire-bookings шлёт push только по ним, поэтому
-- второго push не бывает.
--
-- ПОЧЕМУ ФУНКЦИЯ БАЗЫ, а не запросы в expire-bookings: «кому и когда» и
-- запись в ленту — одна транзакция и одно место. Так же устроены триггеры
-- 42 и 46: ленту пишет база.
--
-- ПРАВА. Только service_role: напоминания ставит планировщик. Новую
-- функцию умолчания Supabase делают исполнимой для anon и authenticated,
-- поэтому права снимаются явно.
-- =============================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'new_request', 'accepted', 'declined',
    'expired_renter', 'expired_owner', 'new_message', 'cancelled',
    'request_reminder', 'return_tomorrow', 'return_unconfirmed'));

-- p_now — ради проверки: предполёт и тесты задают «сейчас» сами, иначе
-- окно 18:00 пришлось бы ждать. Планировщик зовёт без аргумента.
CREATE OR REPLACE FUNCTION public.queue_booking_reminders(p_now timestamptz DEFAULT now())
RETURNS TABLE (user_id uuid, kind text, booking_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH clock AS (
    SELECT (p_now AT TIME ZONE 'Europe/Brussels')::date AS today,
           extract(hour FROM p_now AT TIME ZONE 'Europe/Brussels')::int AS hour
  ),
  due AS (
    SELECT it.owner_id AS user_id, 'request_reminder'::text AS kind, b.id AS booking_id
      FROM public.bookings b
      JOIN public.items it ON it.id = b.item_id
     WHERE b.status = 'pending_approval'
       AND b.created_at <= p_now - interval '18 hours'
       AND b.created_at >  p_now - interval '22 hours'
    UNION ALL
    SELECT b.renter_id, 'return_tomorrow', b.id
      FROM public.bookings b
      CROSS JOIN clock c
     WHERE b.status = 'active'
       AND c.hour >= 18
       AND b.end_date = c.today + 1
       AND b.end_date > b.start_date
    UNION ALL
    SELECT it.owner_id, 'return_unconfirmed', b.id
      FROM public.bookings b
      JOIN public.items it ON it.id = b.item_id
      CROSS JOIN clock c
     WHERE b.status = 'active'
       AND c.hour >= 9
       AND b.end_date = c.today - 1
  ),
  queued AS (
    INSERT INTO public.notifications (user_id, kind, booking_id)
    SELECT d.user_id, d.kind, d.booking_id FROM due d WHERE d.user_id IS NOT NULL
    ON CONFLICT ON CONSTRAINT notifications_once DO NOTHING
    RETURNING notifications.user_id, notifications.kind, notifications.booking_id
  ),
  -- Срок хранения — как у триггеров: кто пишет человеку, тот и чистит
  -- его старое.
  purged AS (
    DELETE FROM public.notifications n
     WHERE n.user_id IN (SELECT q.user_id FROM queued q)
       AND n.created_at < now() - interval '90 days'
    RETURNING n.id
  )
  SELECT q.user_id, q.kind, q.booking_id FROM queued q;
$$;

REVOKE ALL ON FUNCTION public.queue_booking_reminders(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_booking_reminders(timestamptz) TO service_role;

COMMENT ON FUNCTION public.queue_booking_reminders(timestamptz) IS
  'Ставит напоминания в ленту (заявка 18–22 ч, возврат завтра, возврат не отмечен) и возвращает вставленное сейчас — по нему expire-bookings шлёт push. Повтор в том же окне ничего не вставляет.';

COMMENT ON TABLE public.notifications IS
  'Лента событий человека: одна строка на событие брони, сообщение или напоминание. Без текста — он собирается при показе. Пишет база: триггеры на bookings (миграция 46) и booking_messages (миграция 42), напоминания — queue_booking_reminders по расписанию (миграция 57). Клиент читает своё и меняет только read_at. Хранится 90 дней.';
