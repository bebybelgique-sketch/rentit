-- Уборка после supabase/tests/state_machine.mjs.
--
-- Прогон машины состояний заводит настоящие учётки в домене
-- @rentit-test.local. Удаление строки в auth.users каскадом уносит
-- public.users → items → bookings → booking_messages / booking_photos /
-- reviews: все внешние ключи по этой цепочке объявлены ON DELETE CASCADE.
--
-- Домен намеренно нерабочий: .local не резолвится, письма туда не уйдут.

WITH removed AS (
  DELETE FROM auth.users
  WHERE email LIKE '%@rentit-test.%'
  RETURNING id
)
SELECT count(*) AS "удалено учёток" FROM removed;
