-- Уборка после supabase/tests/state_machine.mjs и supabase/tests/edge-functions.mjs.
--
-- Прогоны заводят настоящие учётки в двух нерабочих доменах:
-- @rentit-test.local (машина состояний) и @rentit-test.example
-- (набор edge-функций). Удаление строки в auth.users каскадом уносит
-- public.users → items → bookings → booking_messages / booking_photos /
-- reviews: все внешние ключи по этой цепочке объявлены ON DELETE CASCADE.
--
-- Домены намеренно нерабочие: .local не резолвится, .example
-- зарезервирован RFC 2606 — письма туда не уйдут.
--
-- ПОЧЕМУ ДОМЕНЫ ПЕРЕЧИСЛЕНЫ, А НЕ '%@rentit-test.%'. Это DELETE по
-- auth.users с каскадом на все данные человека. Шаблон с открытым хвостом
-- расширяет область каскадного удаления на домены, которых сегодня нет и
-- о которых никто не подумает завтра. Появится третий домен — его сюда
-- дописывают руками, и это ровно та секунда раздумья, которой шаблон
-- лишает.

WITH removed AS (
  DELETE FROM auth.users
  WHERE email LIKE '%@rentit-test.local'
     OR email LIKE '%@rentit-test.example'
  RETURNING id
)
SELECT count(*) AS "удалено учёток" FROM removed;
