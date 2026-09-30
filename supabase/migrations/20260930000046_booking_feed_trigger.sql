-- =============================================
-- 46. Лента о событиях брони — триггером, в той же транзакции, что статус
-- =============================================
--
-- ЗАЧЕМ. Строку ленты о событии брони писала notify-rental, а её зовут в
-- фоне уже ПОСЛЕ того, как статус записан (notifyRentalInBackground). Не
-- дошёл вызов — холодный старт, сеть, 500 при чтении брони, фон оборвался —
-- и события в ленте нет, а дописать его некому: повтор запроса упирается в
-- 409, потому что статус уже сменился (аудит ретраев 30.09).
--
-- Для сообщений эта дыра закрыта миграцией 42: строку пишет база в той же
-- транзакции, что и само сообщение. Здесь то же для броней: есть смена
-- статуса — есть строка, нет смены — нет строки. Push остаётся за
-- notify-rental: ему нужна сеть.
--
-- Это первый шаг журнала доставки. Строка ленты — запись о том, что
-- человеку причитается уведомление; отметка «доставлено» и повторная
-- отправка push и писем пойдут следующими миграциями.
--
-- КОМУ ЧТО — та же таблица, что была в _shared/push.ts (pushForBookingEvent):
--
--   новая заявка (INSERT pending_approval)   владельцу   new_request
--   pending_approval → confirmed (одобрена)  арендатору  accepted
--   → rejected (отказ, автоотказ)            арендатору  declined
--   → expired (сутки без ответа)             арендатору  expired_renter
--                                            владельцу   expired_owner
--   → cancelled: отменил арендатор           владельцу   cancelled
--                отменил владелец            арендатору  cancelled
--                неизвестно кто (планировщик) обоим      cancelled
--   выдача, возврат, прочее                  ничего
--
-- ПОВТОР НЕ УДВАИВАЕТ: notifications_once держит одну строку на
-- (человек, событие, бронь), вставка — ON CONFLICT DO NOTHING.
--
-- ЦЕНА РЕШЕНИЯ. Строка ленты теперь часть той же транзакции: если вставка
-- в ленту упадёт, не запишется и смена статуса. Так же устроены сообщения
-- с миграции 42. Проверка поведения на живой базе, с откатом:
--   npx supabase db query --linked -f supabase/tests/booking_feed.sql
--
-- SECURITY DEFINER — как у триггера сообщений: запись в ленту не зависит
-- от того, чьими правами меняется статус, а права писать в ленту у
-- клиентов нет и не будет. search_path закреплён.
-- =============================================

CREATE OR REPLACE FUNCTION public.record_booking_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_to    uuid[] := '{}';
  v_kind  text[] := '{}';
  i       int;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT it.owner_id INTO v_owner FROM public.items it WHERE it.id = NEW.item_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending_approval' THEN
      v_to := ARRAY[v_owner];                 v_kind := ARRAY['new_request'];
    END IF;
  ELSIF NEW.status = 'confirmed' AND OLD.status = 'pending_approval' THEN
    v_to := ARRAY[NEW.renter_id];             v_kind := ARRAY['accepted'];
  ELSIF NEW.status = 'rejected' THEN
    v_to := ARRAY[NEW.renter_id];             v_kind := ARRAY['declined'];
  ELSIF NEW.status = 'expired' THEN
    v_to := ARRAY[NEW.renter_id, v_owner];    v_kind := ARRAY['expired_renter', 'expired_owner'];
  ELSIF NEW.status = 'cancelled' THEN
    IF NEW.cancelled_by = NEW.renter_id THEN
      v_to := ARRAY[v_owner];                 v_kind := ARRAY['cancelled'];
    ELSIF NEW.cancelled_by = v_owner THEN
      v_to := ARRAY[NEW.renter_id];           v_kind := ARRAY['cancelled'];
    ELSE
      v_to := ARRAY[NEW.renter_id, v_owner];  v_kind := ARRAY['cancelled', 'cancelled'];
    END IF;
  END IF;

  FOR i IN 1 .. coalesce(array_length(v_to, 1), 0) LOOP
    CONTINUE WHEN v_to[i] IS NULL;

    INSERT INTO public.notifications (user_id, kind, booking_id)
    VALUES (v_to[i], v_kind[i], NEW.id)
    ON CONFLICT ON CONSTRAINT notifications_once DO NOTHING;

    -- Срок хранения: у того, кому пишем, — по индексу (user_id, created_at).
    DELETE FROM public.notifications
     WHERE user_id = v_to[i] AND created_at < now() - interval '90 days';
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_booking_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_record_notification ON public.bookings;
CREATE TRIGGER bookings_record_notification
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.record_booking_notification();

COMMENT ON TABLE public.notifications IS
  'Лента событий человека: одна строка на событие брони или сообщение. Без текста — он собирается при показе. Пишет база: триггеры на bookings (миграция 46) и booking_messages (миграция 42); клиент читает своё и меняет только read_at. Хранится 90 дней.';
