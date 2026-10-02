-- =============================================
-- 49. Вещь с живыми бронями не удаляется — правилом базы
-- =============================================
--
-- ДЫРА. Брони висят на вещи каскадом (bookings.item_id … on delete
-- cascade, миграция 01), а владелец удаляет свою вещь прямым DELETE —
-- политика «Owners can delete own items». Удаление молча стирало чужую
-- заявку или подтверждённую бронь вместе с перепиской, фото и лентой: без
-- отмены, без уведомления. #122 закрыл это в интерфейсе («Mes outils» не
-- даёт удалить), но запрос мимо интерфейса проходил по-прежнему.
--
-- ПРАВИЛО. Пока у вещи есть бронь в статусе pending_approval,
-- pending_payment, confirmed или active, DELETE отклоняется. Выход у
-- каждой такой брони штатный: отказ, отмена, завершение — или скрыть вещь.
-- Закрытые брони (completed, cancelled, rejected, expired) удалению не
-- мешают — как раньше.
--
-- ПОЧЕМУ ТРИГГЕР, А НЕ ON DELETE RESTRICT. Внешний ключ не отличает живую
-- бронь от закрытой: RESTRICT запретил бы удалять вещь с ЛЮБОЙ историей, и
-- удаление учётки падало бы у каждого владельца с одной сделкой.
--
-- ИСКЛЮЧЕНИЕ — удаление учётки. Каскад auth.users → users → items доходит
-- сюда уже без строки владельца. Удаление учётки с живыми бронями
-- отклоняет сама delete-account (409), а уборка тестовых учёток
-- (supabase/tests/cleanup_test_accounts.sql) идёт именно этим путём —
-- запрет здесь сломал бы её, ничего не защитив.
--
-- ПРОВЕРКА — на живой базе DO-блоком с откатом; поведение уборки после
-- прогонов — scripts/close-live-bookings.mjs (#127) закрывает брони до
-- удаления.
-- =============================================

CREATE OR REPLACE FUNCTION public.forbid_item_delete_with_live_bookings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_live int;
BEGIN
  -- Каскад удаления учётки: владельца уже нет — см. шапку.
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.owner_id) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_live
    FROM public.bookings
   WHERE item_id = OLD.id
     AND status IN ('pending_approval', 'pending_payment', 'confirmed', 'active');

  IF v_live > 0 THEN
    RAISE EXCEPTION 'item_has_live_bookings'
      USING ERRCODE = '23503',
            DETAIL = format('%s live booking(s) on item %s', v_live, OLD.id),
            HINT = 'Close the bookings (reject, cancel, complete) or hide the item instead.';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.forbid_item_delete_with_live_bookings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS items_forbid_delete_with_live_bookings ON public.items;
CREATE TRIGGER items_forbid_delete_with_live_bookings
  BEFORE DELETE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.forbid_item_delete_with_live_bookings();
