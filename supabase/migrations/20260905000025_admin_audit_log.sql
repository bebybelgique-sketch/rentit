-- =============================================
-- RentIt: журнал действий администратора
--
-- ЗАЧЕМ. До сих пор права администратора выдавались из браузера прямым
-- UPDATE по users.role, и следа от этого не оставалось нигде: кто, кому и
-- когда выдал доступ ко всем данным площадки, ответить было нечем. (Тот
-- UPDATE к тому же не работал — политика пришпиливает role к текущему
-- значению, см. заметку в 20260812000017. Кнопка была, действия не было.)
-- Теперь действие выполняет edge-функция admin-action служебным ключом,
-- а сюда пишется строка на каждое такое действие.
--
-- ЧТО ЭТО НЕ ЕСТЬ. Это не журнал изменений данных и не система событий
-- (для продуктовых событий есть public.events). Здесь только то, что
-- сделал человек с правами администратора над чужой строкой.
-- =============================================

create table if not exists public.admin_audit_log (
  id           bigint generated always as identity primary key,

  -- Кто. Столбец НЕ NOT NULL, и это осознанно: удаление аккаунта
  -- (delete-account → auth.admin.deleteUser) сносит строку в public.users
  -- каскадом. С `on delete restrict` журнал заблокировал бы удаление
  -- аккаунта, то есть право на забвение из GDPR.md уперлось бы в наш
  -- собственный лог. С `on delete set null` запись переживает автора:
  -- «кто» теряется, «что и над чем» остаётся.
  actor_id     uuid references public.users(id) on delete set null,

  action       text        not null,
  target_table text        not null,
  target_id    uuid        not null,

  -- Разобранное действие целиком: значение, которое поставили, видно без
  -- сопоставления с кодом функции. Пишет его сервер после валидации, а не
  -- клиент — произвольные поля из тела запроса сюда не попадают.
  payload      jsonb       not null default '{}'::jsonb,

  created_at   timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

-- Политик намеренно НЕТ: при включённом RLS и пустом наборе политик
-- anon и authenticated не видят ни строки и не могут вставить свою.
-- Пишет и читает только service_role, который RLS обходит.
--
-- Одного RLS мало — грант тоже надо снять. Урок миграции 20260812000017:
-- табличный грант живёт своей жизнью, и «политик нет» не означает «прав
-- нет», как только кто-нибудь добавит первую политику для чтения.
revoke all on public.admin_audit_log from anon, authenticated;

-- «Что делали с этой строкой» — основной вопрос к журналу.
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_table, target_id);

-- «Что происходило за последнее время» — второй вопрос, и без индекса он
-- на растущей таблице превращается в полный проход.
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — на живой базе:
--
--   -- 1. Клиент таблицу не видит (ожидается ошибка прав или пустой ответ):
--   --    из браузера под обычным пользователем
--   --    supabase.from('admin_audit_log').select('*')
--
--   -- 2. После нажатия «Make admin» в /admin появляется ровно одна строка:
--   select actor_id, action, target_table, target_id, payload, created_at
--     from public.admin_audit_log order by created_at desc limit 5;
--
--   -- 3. Удаление аккаунта автора не роняется об журнал:
--   --    delete-account на тестовой учётке → строка остаётся, actor_id null.
