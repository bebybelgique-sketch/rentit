-- 20260813000021_avatar_delete_policy.sql
--
-- Право удалить СВОЙ аватар.
--
-- У бакета `avatars` с самого начала были политики на запись и обновление:
--   INSERT / UPDATE: auth.uid()::text = split_part(name, '.', 1)
-- а политики на удаление не было ни одной. Пока аватар задавался вставкой
-- ссылки, это не всплывало: файлов в бакете не появлялось вовсе.
--
-- С появлением загрузки файлом (13.08) пробел стал видимым. Имя объекта —
-- `<uid>.<расширение>`, и смена формата НЕ перезаписывает прежний файл:
-- `<uid>.png` и `<uid>.jpg` — разные объекты. Без права на удаление снятая
-- фотография лица оставалась бы в ПУБЛИЧНОМ бакете, доступной по прямой
-- ссылке, пока человек не удалит учётную запись целиком.
--
-- Условие то же, что у соседних политик, — иначе одна и та же проверка
-- разошлась бы в трёх местах.
--
-- Применять как остальные миграции проекта:
--   npx supabase db query --linked < supabase/migrations/20260813000021_avatar_delete_policy.sql

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;

CREATE POLICY "Users delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = split_part(name, '.', 1)
  );

-- И право ВИДЕТЬ свой объект. Без него удаление молча не работает.
--
-- Замерено 13.08 на живом хранилище: `remove()` возвращал успех, файл
-- оставался на месте. Причина — политик SELECT у `avatars` не было вовсе:
-- бакет публичный, и картинка по прямой ссылке открывается в обход RLS, но
-- операции через API (`list`, `remove`) сначала ищут строку в
-- `storage.objects` — и не находят её.
--
-- Область намеренно уже, чем у `item-photos` («публичное чтение»): там имя
-- файла случайное, а здесь имя объекта — это идентификатор человека, и
-- открытый список позволил бы перебрать всех пользователей. Своё видно
-- владельцу, чужое — никому; показ картинки это не ломает, он идёт по
-- публичному адресу.
DROP POLICY IF EXISTS "Users read own avatar object" ON storage.objects;

CREATE POLICY "Users read own avatar object"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = split_part(name, '.', 1)
  );
