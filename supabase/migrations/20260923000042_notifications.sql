-- 42. Лента событий: «что случилось, пока меня не было».
--
-- ЗАЧЕМ. Push живёт только в шторке устройства: смахнул — пропало, на
-- другом устройстве его и не было, а у отказавшихся от уведомлений его нет
-- вовсе. Приложение показывало СОСТОЯНИЕ («À faire maintenant», «Ce qui
-- vous attend»), но не историю: отказ, истёкшая заявка, отмена второй
-- стороной — без пометки «новое». А у сообщений не было «непрочитано»
-- нигде: сообщение от собеседника оставалось невидимым, пока человек не
-- откроет именно эту бронь.
--
-- ОДНО СОБЫТИЕ — ОДНА ЗАПИСЬ, и push рядом. Пишут те же функции, что шлют
-- push (notify-rental, notify-message), и пишут ВСЕГДА — от того, включён
-- ли push, лента не зависит.
--
-- ЧТО ХРАНИТСЯ. Кому, что за событие, какая бронь или сообщение, когда,
-- прочитано ли. ТЕКСТА НЕТ: он собирается при показе — на языке, который
-- выбран сейчас, из тех же фраз, что и push (_shared/pushCopy.ts), и из
-- текущих данных брони. Сменил язык — лента сменилась вместе с ним; копии
-- переписки здесь не лежит.
--
-- СРОК — 90 ДНЕЙ, и следит за ним функция записи (подчищает старое у того,
-- кому пишет): ручной шаг «не забыть почистить» однажды не делается.

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind       text        NOT NULL CHECK (kind IN (
               'new_request', 'accepted', 'declined',
               'expired_renter', 'expired_owner', 'new_message', 'cancelled')),
  booking_id uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  message_id uuid                 REFERENCES public.booking_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz,
  -- Одно событие — одна запись, даже если функцию позовут дважды
  -- (повтор запроса, два процесса истечения). NULLS NOT DISTINCT — чтобы
  -- событие брони без сообщения тоже считалось одним.
  CONSTRAINT notifications_once UNIQUE NULLS NOT DISTINCT (user_id, kind, booking_id, message_id),
  -- Сообщение — только у события о сообщении.
  CONSTRAINT notifications_message_kind CHECK ((kind = 'new_message') = (message_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
-- Счётчик колокольчика — самый частый запрос, и он про непрочитанные.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_booking ON public.notifications (booking_id);

-- Умолчания Supabase выдают новой таблице ВСЕ права для anon и
-- authenticated (docs/table-privileges-2026-09-18.md). Снимаем всё и
-- выдаём ровно нужное:
--   читать   — своё (политика ниже);
--   менять   — ТОЛЬКО read_at, и только у своего: отметить прочитанным.
--              Ни kind, ни booking_id, ни чужую строку не поменять.
--   писать   — никому из клиентов: записи ставят функции (service_role).
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own notifications are readable" ON public.notifications;
CREATE POLICY "Own notifications are readable" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own notifications can be marked read" ON public.notifications;
CREATE POLICY "Own notifications can be marked read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── СООБЩЕНИЯ — ТРИГГЕРОМ, В ТОЙ ЖЕ ТРАНЗАКЦИИ ───────────────────────
--
-- События броней пишет notify-rental: их проводят функции сервера, и
-- запись идёт рядом с push. Сообщение же вставляет САМ КЛИЕНТ, а
-- notify-message зовёт его браузер после вставки. Оборвалась сеть сразу
-- после «отправить», открыта старая вкладка без этого вызова — и у
-- получателя не осталось бы ни push, ни строки в ленте: ровно та дыра,
-- ради которой лента заведена.
--
-- Поэтому строку о сообщении пишет база, в той же транзакции, что и само
-- сообщение: нет сообщения — нет строки, есть сообщение — строка есть
-- наверняка. Push остаётся за функцией: ему нужна сеть.
--
-- SECURITY DEFINER — потому что у вставляющего (authenticated) права на
-- запись в ленту нет и не будет; search_path закреплён.
CREATE OR REPLACE FUNCTION public.record_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
BEGIN
  SELECT CASE WHEN NEW.sender_id = b.renter_id THEN i.owner_id ELSE b.renter_id END
    INTO recipient
    FROM public.bookings b
    JOIN public.items i ON i.id = b.item_id
   WHERE b.id = NEW.booking_id;

  IF recipient IS NOT NULL AND recipient <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, kind, booking_id, message_id)
    VALUES (recipient, 'new_message', NEW.booking_id, NEW.id)
    ON CONFLICT ON CONSTRAINT notifications_once DO NOTHING;

    -- Срок хранения: у того, кому пишем, — по индексу (user_id, created_at).
    DELETE FROM public.notifications
     WHERE user_id = recipient AND created_at < now() - interval '90 days';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_message_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_messages_record_notification ON public.booking_messages;
CREATE TRIGGER booking_messages_record_notification
  AFTER INSERT ON public.booking_messages
  FOR EACH ROW EXECUTE FUNCTION public.record_message_notification();

COMMENT ON TABLE public.notifications IS
  'Лента событий человека: одна строка на событие брони или сообщение. Без текста — он собирается при показе. Пишут notify-rental и notify-message; клиент читает своё и меняет только read_at. Хранится 90 дней.';

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ (на живой базе, не на веру):
--   аноним GET /rest/v1/notifications                   → 401, 42501
--   вошедший: SELECT — только свои строки; INSERT        → 42501
--   вошедший: UPDATE kind / booking_id                   → 42501
--   вошедший: UPDATE read_at у своей строки              → проходит
