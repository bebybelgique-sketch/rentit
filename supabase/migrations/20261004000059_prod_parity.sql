-- =============================================
-- 59. Паритет: то, что есть на проде, но не было в истории миграций
-- =============================================
--
-- ЗАЧЕМ. 03.10 стенд rentit-staging подняли из истории миграций (1–57), и
-- сверка схем с продом показала: часть прода заведена руками в панели или
-- выдана умолчаниями Supabase в момент создания объектов. На чистой базе
-- этого нет, и пять прогонов E2E подряд падали на стенде по этой причине.
-- Тот же пробел ударил бы при восстановлении прода с нуля — а на бесплатном
-- тарифе резервных копий нет.
--
-- На проде всё ниже ничего не меняет: те же определения (сверено по
-- pg_policies, storage.buckets и proacl прода 03.10.2026). На чистой базе —
-- восстанавливает недостающее.
--
-- Сознательно НЕ переносится (есть только на проде, продукт не использует):
-- таблица events (из файла add_events_table.sql без номера, CLI его
-- пропускает), SELECT на payments для authenticated, расширение pg_graphql.
-- =============================================

-- 1. Публичные бакеты. На проде созданы в панели; миграция 47 только правит
-- их настройки (UPDATE … WHERE id = …) и на чистой базе ничего не находит.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('item-photos', 'item-photos', true, 5 * 1024 * 1024,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'])
ON CONFLICT (id) DO NOTHING;

-- 2. Политики storage.objects, которые есть только на проде. Определения —
-- дословно из pg_policies прода.
DROP POLICY IF EXISTS "Public read item photos" ON storage.objects;
CREATE POLICY "Public read item photos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'item-photos');

DROP POLICY IF EXISTS "Users delete own photos" ON storage.objects;
CREATE POLICY "Users delete own photos" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'item-photos' AND (auth.uid())::text = (storage.foldername(name))[2]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'avatars' AND (auth.uid())::text = split_part(name, '.', 1));

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = split_part(name, '.', 1));

-- 3. Право вызывать служебные функции броней. Миграция 51 сняла его у
-- PUBLIC и anon, рассчитывая, что у authenticated и service_role оно
-- останется. На проде осталось — выдано умолчаниями при создании. На
-- чистой базе его нет, и политики, которые эти функции зовут, падают с
-- «permission denied for function».
GRANT EXECUTE ON FUNCTION public.booking_is_completed(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_item(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_renter(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_booking_participant(uuid, uuid) TO authenticated, service_role;

-- 4. То же для service_role на прочих функциях, как на проде.
GRANT EXECUTE ON FUNCTION public.forbid_item_delete_with_live_bookings() TO service_role;
GRANT EXECUTE ON FUNCTION public.my_invite() TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_user_rating_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_booking_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_message_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.round_item_location() TO service_role;
