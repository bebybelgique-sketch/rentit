-- =============================================
-- 47. Публичные бакеты: снимки вещей — только в свою папку, только картинки
-- =============================================
--
-- ЧТО БЫЛО. Замер прода 01.10.2026 (pg_policies, storage.buckets):
--
--   "Auth users upload item photos"  INSERT
--     WITH CHECK (bucket_id = 'item-photos' AND auth.uid() IS NOT NULL)
--   item-photos: public = true, file_size_limit = NULL, allowed_mime_types = NULL
--   avatars:     public = true, file_size_limit = NULL, allowed_mime_types = NULL
--
-- То есть любой вошедший кладёт в ПУБЛИЧНЫЙ бакет файл по любому пути,
-- любого типа и размера, и раздаётся он с домена хранилища проекта:
-- HTML-страница или SVG со скриптом под нашим адресом, чужие файлы на
-- наш счёт. Ограничение размера и типа жило только в браузере (ListItem,
-- useUploadAvatar) — запрос мимо интерфейса его не знает.
--
-- Удаление при этом уже было по папке ("Users delete own photos":
-- (storage.foldername(name))[2] = auth.uid()) — вставка просто отстала.
--
-- ЧТО СТАЛО.
--   • вставка в item-photos — только в items/<свой uid>/…, тем же правилом,
--     что удаление. Так грузят и ListItem, и EditItem (useUploadImage);
--   • оба публичных бакета: до 5 МБ (предел из ListItem и useUploadAvatar)
--     и только растровые картинки. SVG нет намеренно: в публичном бакете
--     это скрипт под нашим доменом.
--
-- Бакет booking-photos не трогается: он приватный, с путём по брони и уже
-- с лимитами (миграция 11).
--
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — node supabase/tests/photo_storage.mjs:
-- своя папка — 200; чужая папка, корень бакета, text/html — отказ.
-- =============================================

DROP POLICY IF EXISTS "Auth users upload item photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload item photos to own folder" ON storage.objects;
CREATE POLICY "Owners upload item photos to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'item-photos'
    AND (storage.foldername(name))[1] = 'items'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

UPDATE storage.buckets
   SET file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']
 WHERE id = 'item-photos';

UPDATE storage.buckets
   SET file_size_limit = 5 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'avatars';
