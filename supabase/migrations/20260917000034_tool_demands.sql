-- =============================================
-- Миграция 34: названный спрос на пустой витрине
-- =============================================
--
-- ЗАЧЕМ. Замер прода 17.09.2026: `select count(*) from items` = 0,
-- `browse_items` возвращает []. Пустой поиск — не крайний случай, а ЕДИНСТВЕННОЕ
-- состояние, которое сегодня видит любой пришедший. У такого экрана есть работа,
-- которую не выполняет ни одна картинка: спросить, ЧТО человек искал.
--
-- Без этой таблицы вопрос «какой инструмент засевать первым» отвечается
-- догадкой. С ней — списком того, что люди действительно набирали в поиске.
-- Это единственный прибор на витрине без предложения, и он дешевле любого
-- опроса: человек уже здесь и уже искал.
--
-- ПОЧЕМУ ЗДЕСЬ НЕТ ПОЧТЫ. Адрес просят, чтобы написать, когда инструмент
-- появится. Канал письма в продукте на сегодня не подтверждён (RESEND_API_KEY,
-- см. supabase/functions/_shared/notify.ts — там же описано, что при отсутствии
-- ключа функция отвечает 500, а провал был невидим). Собирать персональные
-- данные под обещание, которое может не исполниться, нельзя — ни по GDPR.md,
-- ни по правилу продукта не обещать канал (то же основание, по которому с
-- экрана заявки убрали «Vous serez notifié par email»).
--
-- Колонка `email` добавляется ОДНОЙ строкой в тот день, когда письмо
-- действительно уходит и это проверено. Не раньше.
--
-- ПОЧЕМУ ТАБЛИЦА ПИШУЩАЯ, НО НЕ ЧИТАЮЩАЯ. Политика одна — на вставку. Политики
-- на чтение нет НАМЕРЕННО: список спроса — это то, что люди сказали продукту,
-- а не друг другу. Читает его только service_role (SQL-консоль, как и
-- admin_audit_log). Поэтому же хук вставляет БЕЗ `.select()`: PostgREST с
-- `return=minimal` не требует права на чтение.
-- =============================================

create table if not exists public.tool_demands (
  id             uuid primary key default gen_random_uuid(),
  -- Что человек назвал. Обязательно: запись без инструмента ничего не измеряет.
  tool           text not null,
  -- Строка, которая была в поиске в момент вопроса. Может отличаться от `tool`:
  -- человеку дают исправить подставленное. Расхождение этих двух полей само по
  -- себе сведение — оно показывает, что поиск понял не то.
  searched_query text,
  -- Язык интерфейса в момент записи: спрос на фламандском и на французском
  -- засевается в разных местах.
  locale         text,
  created_at     timestamptz not null default now(),

  -- Границы длины, а не доверие к клиенту: таблица открыта на запись анониму,
  -- и единственное, что удерживает её размер, — проверка на стороне базы.
  constraint tool_demands_tool_len
    check (char_length(btrim(tool)) between 1 and 120),
  constraint tool_demands_query_len
    check (searched_query is null or char_length(searched_query) <= 200),
  constraint tool_demands_locale_len
    check (locale is null or char_length(locale) <= 8)
);

alter table public.tool_demands enable row level security;

-- Спрос называют ДО регистрации — иначе прибор измерял бы только тех, кто уже
-- остался. Поэтому anon, а не только authenticated.
drop policy if exists "Anyone can record a tool demand" on public.tool_demands;
create policy "Anyone can record a tool demand" on public.tool_demands
  for insert to anon, authenticated
  with check (true);

grant insert on public.tool_demands to anon, authenticated;
grant select, insert, update, delete on public.tool_demands to service_role;

-- Чтение списка: самое частое из того, что спрашивали, и сколько раз.
comment on table public.tool_demands is
  'Названный спрос с пустой витрины. Читать: select btrim(lower(tool)) as outil, count(*) from public.tool_demands group by 1 order by 2 desc;';
