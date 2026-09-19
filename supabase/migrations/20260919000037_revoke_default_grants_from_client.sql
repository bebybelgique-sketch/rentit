-- =============================================
-- Миграция 37: снят класс привилегий, пришедших из умолчания Supabase
-- =============================================
--
-- ЧТО ЧИНИМ. В схеме public у Supabase стоит
--
--   alter default privileges in schema public
--     grant all on tables to anon, authenticated;
--
-- Значит базовое состояние НОВОЙ таблицы — не «прав нет», а «права есть
-- ВСЕ», и ни одной строки об этом в миграциях проекта не появляется. По
-- миграциям картина выглядит противоположной, и сторож привилегий
-- (scripts/check-migration-grants.mjs) соглашался с ней до 19.09.2026.
--
-- Живая база 18.09 ответила иначе (docs/table-privileges-2026-09-18.md):
--
--   DELETE /bookings  → 204   право DELETE есть
--   DELETE /users     → 204   право DELETE есть
--   DELETE /reviews   → 204   право DELETE есть
--   GET /tool_demands → 200   право SELECT есть
--
-- Строк при этом не возвращается и не удаляется — их не отдаёт RLS. То
-- есть защита стоит на ОДНОМ рубеже вместо двух, и стоит молча: тот, кто
-- завтра добавит узкую политику, получит вместе с ней полный табличный
-- грант, и красным при этом не станет ничего.
--
-- ЧТО СНИМАЕТСЯ ЗДЕСЬ, И ПОЧЕМУ ИМЕННО ЭТО
--
-- 1. TRUNCATE, REFERENCES, TRIGGER — на ВСЕХ клиентских таблицах сразу.
--    Это класс, а не набор случаев: ни одну из трёх PostgREST выразить не
--    может в принципе — нет ни маршрута, ни глагола. Клиент ходит в базу
--    только через PostgREST и edge-функции (последние под service_role).
--    Снятие не может изменить поведение продукта, потому что
--    воспользоваться этими правами из браузера нечем.
--
-- 2. public.users — INSERT и DELETE.
--    INSERT: строку в public.users заводит ТРИГГЕР handle_new_user на
--    auth.users (миграция 31, SECURITY DEFINER) — браузер туда не пишет
--    никогда. В коде `supabase.from('users')` встречается только с
--    .select() и .update() (useProfile, useUpdateProfile, Register,
--    ListItem, Admin).
--    DELETE: удаление учётки идёт edge-функцией (useDeleteAccount →
--    delete-account), то есть под service_role.
--    SELECT и UPDATE у клиента остаются КОЛОНОЧНЫМИ (миграции 07, 14, 17)
--    и этой миграцией не затрагиваются — колоночные гранты живут отдельно
--    от табличных.
--
-- 3. public.bookings — DELETE.
--    Клиент не удаляет брони ниоткуда: в src/hooks/mutations нет ни одного
--    .delete() по bookings. Брони вещи уходят КАСКАДОМ по внешнему ключу
--    bookings.item_id при удалении вещи (useDeleteItem). Каскад исполняет
--    внутренний триггер от имени владельца таблицы и привилегию текущей
--    роли на дочерней таблице НЕ спрашивает — поэтому снятие DELETE
--    удаление вещи не ломает.
--
-- ЧЕГО ЗДЕСЬ НЕТ. DML на reviews (UPDATE, DELETE), booking_messages
-- (UPDATE, DELETE), booking_photos (UPDATE), payments (всё), events (всё).
-- Каждая из них требует отдельной сверки с кодом: у reviews и
-- booking_messages политики на запись ЕСТЬ, и снимать табличное право,
-- не прочитав политику, значит менять поведение вслепую. Они заморожены
-- поимённо в scripts/migration-grants-allowlist.json и снимаются
-- следующими миграциями — по одной таблице, с названным местом в коде.
--
-- ОТКАТ. Обратное действие — GRANT с теми же именами. Ошибка здесь не
-- молчит: клиент получит 401 / 42501 `permission denied for table …`.
--
-- ПРОВЕРКА НА ЖИВОЙ БАЗЕ ПОСЛЕ ВЫКАТА (ключ anon, ни одной строки не
-- меняется — id заведомо несуществующий):
--
--   curl -s -o /dev/null -w '%{http_code}\n' -X DELETE \
--     "$SUPABASE_URL/rest/v1/bookings?id=eq.00000000-0000-0000-0000-000000000000" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--
--   было 204 · ожидается 401
--
-- =============================================

-- 1. Класс, которым из браузера воспользоваться нечем.
--    По одному оператору на таблицу — как во всех миграциях этого проекта.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.users            FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.items            FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.bookings         FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.reviews          FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.payments         FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.booking_messages FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.booking_photos   FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.item_blackouts   FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.tool_demands     FROM anon, authenticated;

-- 2. users: строку заводит триггер, удаляет edge-функция.
revoke insert, delete on public.users from anon, authenticated;

-- 3. bookings: клиент не удаляет брони; вещи уносят их каскадом.
revoke delete on public.bookings from anon, authenticated;

-- 4. public.events — снимается ВСЁ, и снимается ОТДЕЛЬНО, под проверкой.
--
-- ПОЧЕМУ ОТДЕЛЬНО. Таблицу создаёт supabase/migrations/add_events_table.sql,
-- и этот файл `supabase db push` НЕ ПРИМЕНЯЕТ НИКОГДА. CLI говорит об этом
-- вслух на каждом запуске:
--
--   Skipping migration add_events_table.sql...
--   (file name must match pattern "<timestamp>_name.sql")
--
-- При этом на проде таблица ЕСТЬ — её завели руками:
--   GET /rest/v1/events?select=id&limit=1  ->  200 []   (ключ anon, 19.09)
--
-- Значит в чистой базе, поднятой из миграций, её не будет. Безусловный
-- revoke упал бы там с `relation does not exist` и оборвал бы всю цепочку
-- миграций на этом файле. Отсюда проверка через to_regclass: на проде
-- сработает, на чистой базе тихо пропустится.
--
-- ПОЧЕМУ ВСЁ, А НЕ ТРИ ПРИВИЛЕГИИ. Продукт этой таблицей не пользуется
-- нигде: `from('events')` не встречается ни в src, ни в edge-функциях.
-- А права у клиента на ней полные — из умолчания. В файле, которым её
-- заводили, лежит ещё и политика
--
--   CREATE POLICY "Anyone can insert events" ... WITH CHECK (true)
--
-- то есть ОБА рубежа на запись открыты: и табличное право, и политика.
-- Проверять это вставкой строки в прод я не стал — синтетика в живой базе
-- остаётся в ней навсегда, а вывод от неё не меняется. Состав политик на
-- проде НЕ СВЕРЕН; снятие табличного права закрывает запись независимо от
-- того, в каком они виде.
--
-- Понадобится аналитика — грант выдаётся осознанно и отдельной миграцией.
do $$
begin
  if to_regclass('public.events') is not null then
    execute 'revoke all on public.events from anon, authenticated';
  end if;
end $$;
