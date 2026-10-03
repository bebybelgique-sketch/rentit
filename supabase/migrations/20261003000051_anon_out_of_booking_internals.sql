-- =============================================
-- 51. Аноним не дотягивается до внутренностей сделки
-- =============================================
--
-- ЧТО БЫЛО (сверено на проде 03.10). Ключ anon лежит в бандле — он
-- публичный, и всё, что разрешено роли anon, разрешено любому человеку с
-- консолью браузера.
--
-- 1. Служебные SECURITY DEFINER-функции исполнялись анонимом:
--
--      unservable_pending_requests(item, exclude) — отдаёт id ЗАЯВОК на
--        любую вещь (id вещей публичны). Зовёт её только respond-to-request
--        под service_role;
--      booking_renter / booking_owner / booking_item / booking_is_completed
--        / is_booking_participant — по id брони отвечают, кто арендатор и
--        владелец. Вместе с первой это цепочка «вещь → заявки на неё → кто
--        их подал»: имена в users публичны;
--      recompute_user_rating_for(user) — пересчёт рейтинга любого человека
--        по запросу. Зовёт её только триггер на reviews.
--
--    EXECUTE на функцию в Postgres по умолчанию выдан PUBLIC, а Supabase
--    сверху выдаёт его anon и authenticated явно. Снимать надо у PUBLIC и у
--    anon: снятое только у anon вернулось бы через PUBLIC.
--
-- 2. Табличные права анонима, которыми не пользуется ни одна страница
--    гостя. Каждую строку держала только политика RLS — один рубеж вместо
--    двух (тот же класс, что миграция 37):
--
--      booking_messages  INSERT, SELECT
--      booking_photos    DELETE, INSERT, SELECT
--      bookings          SELECT
--      item_blackouts    DELETE, INSERT, SELECT, UPDATE
--      items             DELETE, INSERT, UPDATE
--      payments          SELECT
--      reviews           INSERT
--
-- ЧТО ОСТАЁТСЯ АНОНИМУ — и где этим пользуются.
--   items SELECT        витрина и страница вещи (useBrowseItems, useItemById);
--   reviews SELECT      отзывы на странице вещи и профиля;
--   tool_demands INSERT форма «назовите инструмент» на пустой витрине (Home);
--   item_calendar, unavailable_days, items_busy_between, item_earliest_start,
--   item_history — календарь и фильтр занятости для гостя; они SECURITY
--   DEFINER и сами решают, что отдать, поэтому табличные права на брони и
--   перерывы гостю не нужны.
--   is_booking_photo_participant — НЕ трогается: её зовёт политика на
--   storage.objects, общая для всех бакетов. Без EXECUTE у анонима любой его
--   запрос к хранилищу падал бы на проверке функции, а не на строках. Она и
--   ничего не раскрывает: для анонима auth.uid() пуст, ответ всегда false.
--
-- ВОШЕДШИЙ (authenticated) НЕ ТРОГАЕТСЯ, кроме двух служебных функций:
-- политики на booking_messages, booking_photos и reviews вычисляются от его
-- имени и зовут booking_* и is_booking_participant — без EXECUTE у него
-- перестала бы работать переписка.
--
-- ПРОВЕРКА — до выката DO-блоком с откатом на живой базе (роль anon и
-- вошедший участник); после — scripts/check-migration-grants.mjs (храповик
-- сокращён) и supabase/tests/edge-functions.mjs.
-- =============================================

-- 1. Служебные функции — только серверу и триггерам.
REVOKE EXECUTE ON FUNCTION public.unservable_pending_requests(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_rating_for(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Помощники политик — вошедшим, не анониму.
REVOKE EXECUTE ON FUNCTION public.booking_is_completed(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.booking_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.booking_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.booking_renter(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_booking_participant(uuid, uuid) FROM PUBLIC, anon;

-- 3. Таблицы сделки — гостю ни читать, ни писать.
REVOKE ALL ON public.booking_messages FROM anon;
REVOKE ALL ON public.booking_photos FROM anon;
REVOKE ALL ON public.bookings FROM anon;
REVOKE ALL ON public.item_blackouts FROM anon;
REVOKE ALL ON public.payments FROM anon;

-- 4. Витрина и отзывы — гостю только читать.
REVOKE INSERT, UPDATE, DELETE ON public.items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM anon;
