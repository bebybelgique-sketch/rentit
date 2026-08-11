-- =============================================
-- RentIt: Maturity
-- Переписка по брони, фото состояния при передаче и возврате,
-- отмена с указанием стороны и причины, взаимные отзывы и репутация.
--
-- Модель бесплатная: платформа денег не касается. Поля вида
-- deposit_returned_at сознательно НЕ добавляются — они создавали бы
-- ложное впечатление, что площадка участвует в расчётах. Факт возврата
-- фиксируется переходом брони в completed и фотографиями возврата.
-- =============================================

-- ---------------------------------------------
-- 0. Помощники по броне
-- SECURITY DEFINER, чтобы политики на booking_messages / booking_photos /
-- reviews не зависели от RLS на bookings и items: иначе видимость
-- сообщения определялась бы политиками чужой таблицы, а изменение тех
-- политик молча меняло бы доступ здесь.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.booking_renter(p_booking_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.renter_id FROM public.bookings b WHERE b.id = p_booking_id;
$$;

CREATE OR REPLACE FUNCTION public.booking_owner(p_booking_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.owner_id
  FROM public.bookings b
  JOIN public.items i ON i.id = b.item_id
  WHERE b.id = p_booking_id;
$$;

CREATE OR REPLACE FUNCTION public.booking_item(p_booking_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.item_id FROM public.bookings b WHERE b.id = p_booking_id;
$$;

CREATE OR REPLACE FUNCTION public.booking_is_completed(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = p_booking_id AND b.status = 'completed'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_booking_participant(p_booking_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.bookings b
       JOIN public.items i ON i.id = b.item_id
       WHERE b.id = p_booking_id
         AND (b.renter_id = p_user_id OR i.owner_id = p_user_id)
     );
$$;

-- ---------------------------------------------
-- 1. Переписка по брони
-- Договориться о месте и времени передачи — часть цикла, без неё
-- стороны уходят в WhatsApp и площадка перестаёт видеть сделку.
-- Сообщения неизменяемы: политик UPDATE/DELETE нет намеренно.
-- ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  body       text NOT NULL CHECK (btrim(body) <> '' AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_created
  ON public.booking_messages (booking_id, created_at);

ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read booking messages" ON public.booking_messages;
CREATE POLICY "Participants read booking messages" ON public.booking_messages
  FOR SELECT
  USING (public.is_booking_participant(booking_id, auth.uid()));

DROP POLICY IF EXISTS "Participants send booking messages" ON public.booking_messages;
CREATE POLICY "Participants send booking messages" ON public.booking_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_booking_participant(booking_id, auth.uid())
  );

-- ---------------------------------------------
-- 2. Фото состояния
-- Хранится путь в приватном бакете, не публичный URL: иначе ссылка на
-- чужую вещь в чужой квартире становится вечной и общедоступной.
-- ---------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  phase        text NOT NULL CHECK (phase IN ('handover', 'return')),
  storage_path text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_photos_booking_phase
  ON public.booking_photos (booking_id, phase, created_at);

ALTER TABLE public.booking_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read booking photos" ON public.booking_photos;
CREATE POLICY "Participants read booking photos" ON public.booking_photos
  FOR SELECT
  USING (public.is_booking_participant(booking_id, auth.uid()));

DROP POLICY IF EXISTS "Participants add booking photos" ON public.booking_photos;
CREATE POLICY "Participants add booking photos" ON public.booking_photos
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.is_booking_participant(booking_id, auth.uid())
  );

-- Свою неудачную фотографию можно убрать; чужую — нет.
DROP POLICY IF EXISTS "Uploader removes own booking photo" ON public.booking_photos;
CREATE POLICY "Uploader removes own booking photo" ON public.booking_photos
  FOR DELETE
  USING (uploaded_by = auth.uid());

-- ---------------------------------------------
-- 3. Отмена: кто, когда и почему
-- ---------------------------------------------

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- ---------------------------------------------
-- 4. Репутация людей
-- rating_as_owner / rating_as_renter в users существуют с самого начала,
-- но не вычислялись никем, а политика 20260327000006 запрещает менять их
-- пользователю. Поэтому считает триггер от имени владельца функции.
--
-- Отзывы типа 'item' в рейтинг человека НЕ входят: это оценка вещи,
-- она показывается на странице вещи.
-- ---------------------------------------------

CREATE OR REPLACE FUNCTION public.recompute_user_rating_for(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.users u
  SET rating_as_owner = (
        SELECT round(avg(r.rating)::numeric, 2)
        FROM public.reviews r
        WHERE r.to_user_id = p_user_id AND r.review_type = 'owner'
      ),
      rating_as_renter = (
        SELECT round(avg(r.rating)::numeric, 2)
        FROM public.reviews r
        WHERE r.to_user_id = p_user_id AND r.review_type = 'renter'
      )
  WHERE u.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.recompute_user_rating()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Затронуть можно только адресатов отзыва: на UPDATE это и старый, и новый.
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    PERFORM public.recompute_user_rating_for(OLD.to_user_id);
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.to_user_id IS DISTINCT FROM OLD.to_user_id) THEN
    PERFORM public.recompute_user_rating_for(NEW.to_user_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_user_rating ON public.reviews;
CREATE TRIGGER trg_recompute_user_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_user_rating();

-- Разовый пересчёт по тому, что уже лежит в базе.
SELECT public.recompute_user_rating_for(u.id)
FROM public.users u
WHERE EXISTS (SELECT 1 FROM public.reviews r WHERE r.to_user_id = u.id);

-- ---------------------------------------------
-- 5. Кто кого вправе оценить
-- Прежняя политика "Completed bookings can be reviewed" требовала только
-- from_user_id = auth.uid() и завершённую бронь: посторонний мог написать
-- отзыв о чужой сделке. Заменяем на явные инварианты.
-- ---------------------------------------------

DROP POLICY IF EXISTS "Completed bookings can be reviewed" ON public.reviews;
DROP POLICY IF EXISTS "Participants review the other side after completion" ON public.reviews;

CREATE POLICY "Participants review the other side after completion" ON public.reviews
  FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid()
    AND to_user_id <> from_user_id
    AND public.booking_is_completed(booking_id)
    AND item_id = public.booking_item(booking_id)
    AND (
      -- Арендатор оценивает вещь и владельца.
      (review_type IN ('item', 'owner')
        AND from_user_id = public.booking_renter(booking_id)
        AND to_user_id   = public.booking_owner(booking_id))
      -- Владелец оценивает арендатора.
      OR (review_type = 'renter'
        AND from_user_id = public.booking_owner(booking_id)
        AND to_user_id   = public.booking_renter(booking_id))
    )
  );

-- Повторный отзыв того же типа по той же броне отсекается уникальностью
-- reviews_booking_id_from_user_id_review_type_key, заведённой ранее.

-- ---------------------------------------------
-- 6. Приватный бакет для фото состояния
-- Путь: <booking_id>/<phase>/<файл>. Первый сегмент — ключ доступа.
-- ---------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-photos', 'booking-photos', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Имя объекта приходит извне: нераспознанный первый сегмент — отказ,
-- а не ошибка приведения типа посреди политики.
CREATE OR REPLACE FUNCTION public.is_booking_photo_participant(p_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking uuid;
BEGIN
  BEGIN
    v_booking := split_part(p_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.is_booking_participant(v_booking, auth.uid());
END;
$$;

DROP POLICY IF EXISTS "Participants read booking photo objects" ON storage.objects;
CREATE POLICY "Participants read booking photo objects" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'booking-photos'
    AND public.is_booking_photo_participant(name)
  );

DROP POLICY IF EXISTS "Participants upload booking photo objects" ON storage.objects;
CREATE POLICY "Participants upload booking photo objects" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'booking-photos'
    AND owner = auth.uid()
    AND public.is_booking_photo_participant(name)
  );

DROP POLICY IF EXISTS "Uploader removes own booking photo object" ON storage.objects;
CREATE POLICY "Uploader removes own booking photo object" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'booking-photos'
    AND owner = auth.uid()
  );

-- ---------------------------------------------
-- 7. Права ролей
-- Политика решает «какие строки», грант — «есть ли доступ к таблице
-- вообще». Без гранта RLS не спасает: запрос падает раньше неё.
-- Анонимному в переписке и фотографиях делать нечего.
-- ---------------------------------------------

GRANT SELECT, INSERT         ON public.booking_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.booking_photos   TO authenticated;
