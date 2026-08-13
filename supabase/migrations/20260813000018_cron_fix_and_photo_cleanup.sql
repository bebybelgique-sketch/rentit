-- 20260813000018_cron_fix_and_photo_cleanup.sql
--
-- ЧТО ЭТО ЧИНИТ
--
-- 1. Расписание `expire-bookings` существует с 02.04.2026 и НЕ ОТРАБОТАЛО НИ
--    РАЗУ. Замерено 13.08: `cron.job_run_details` — 718 запусков, 718 со
--    статусом `failed`, ноль успешных. Две ошибки в одной команде:
--      — адрес без домена: `https://<ref>/functions/v1/…` вместо
--        `https://<ref>.supabase.co/functions/v1/…`; такое имя не резолвится;
--      — в заголовке Authorization осталась подсказка-заглушка, приклеенная
--        к ключу: `Bearer ТВОЙ_SERVICE_ROLE_KEY` + сам ключ одной строкой.
--    Следствие: автоматического истечения броней в продукте нет. Заявка,
--    которую владелец не тронул, висит в `pending_approval` вечно.
--
-- 2. Уборка `cleanup-orphan-photos` расписания не имела вовсе — её
--    запускали руками. Политика конфиденциальности на всех трёх языках
--    обещает «Photos: deleted within 30 days of listing removal»; обещание,
--    исполнение которого зависит от того, вспомнит ли человек нажать
--    кнопку, — не обещание.
--
-- 3. Служебный ключ проекта больше в базе не хранится. Замерено 13.08:
--    значение в старой команде крона побайтово совпадало с
--    `SUPABASE_SERVICE_ROLE_KEY`, которым ходят ВСЕ функции проекта — то
--    есть ключ от всего лежал в `cron.job` открытым текстом ради задания,
--    умеющего одно действие. Теперь у каждой функции свой пропуск:
--    `CRON_TOKEN` и `CLEANUP_TOKEN`. Они открывают ровно свою функцию,
--    меняются в одну команду и ничего больше за собой не тянут.
--
-- ПЕРЕД ЗАПУСКОМ ЗАМЕНИТЬ ТРИ ПОДСТАНОВКИ. Значения в файл не вписаны
-- намеренно: команда крона хранится в базе открытым текстом, и всё, что сюда
-- попадёт, окажется читаемым для всякого, у кого есть доступ к `cron.job`.
--
--   <PROJECT_REF>       — идентификатор проекта Supabase (панель → Settings)
--   <PUBLISHABLE_KEY>   — публикуемый ключ (`sb_publishable_…`, он же
--                         VITE_SUPABASE_ANON_KEY). НЕ секрет: он и так уезжает
--                         в браузерный бандл
--   <CRON_TOKEN>        — значение секрета CRON_TOKEN функций
--   <CLEANUP_TOKEN>     — значение секрета CLEANUP_TOKEN функций
--
-- Оба секрета задаются так:
--   npx supabase secrets set CRON_TOKEN=<значение> CLEANUP_TOKEN=<значение>
--
-- ЗАЧЕМ ДВА ЗАГОЛОВКА. У функций включена проверка JWT на стороне платформы:
-- запрос без `Authorization` отбивается шлюзом (`UNAUTHORIZED_NO_AUTH_HEADER`)
-- ещё до нашего кода — замерено 13.08 curl'ом. Поэтому:
--   Authorization  — пропуск через шлюз, публичным ключом, не секрет;
--   X-Cron-Token / X-Cleanup-Token — настоящая проверка, уже в нашем коде.
-- Одного публичного ключа мало: с ним и без своего токена функция отвечает
-- 401 (проверено).
--
-- Применять как остальные миграции проекта:
--   npx supabase db query --linked < supabase/migrations/20260813000018_cron_fix_and_photo_cleanup.sql
-- (`supabase db push` СЛОМАЕТ базу: `schema_migrations` пуста для всех
-- миграций, их применяли вручную.)

-- --------------------------------------------------------------------------
-- 1. Истечение заявок: пересоздаём задание с рабочим адресом и заголовком
-- --------------------------------------------------------------------------

SELECT cron.unschedule('expire-bookings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-bookings');

SELECT cron.schedule(
  'expire-bookings',
  '*/30 * * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/expire-bookings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <PUBLISHABLE_KEY>',
      'X-Cron-Token',  '<CRON_TOKEN>',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $job$
);

-- --------------------------------------------------------------------------
-- 2. Уборка осиротевших снимков: раз в сутки
-- --------------------------------------------------------------------------
--
-- Почему раз в сутки, а не каждые полчаса: функция обходит оба бакета
-- целиком. Обещанный срок — 30 дней, суточный проход даёт тридцатикратный
-- запас и не создаёт нагрузки на пустом продукте.
--
-- 03:15 UTC — вне часов, когда человек может смотреть витрину, и не в ноль
-- минут: в ноль стартует всё остальное.
--
-- Свой заголовок, не Authorization: функция ходит по ВСЕМУ бакету, это не
-- операция одной стороны сделки, и пользовательский токен ей не подходит
-- намеренно (см. шапку `cleanup-orphan-photos/index.ts`).

SELECT cron.unschedule('cleanup-orphan-photos')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphan-photos');

SELECT cron.schedule(
  'cleanup-orphan-photos',
  '15 3 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-orphan-photos',
    headers := jsonb_build_object(
      'Authorization',   'Bearer <PUBLISHABLE_KEY>',
      'X-Cleanup-Token', '<CLEANUP_TOKEN>',
      'Content-Type',    'application/json'
    ),
    body    := '{}'::jsonb
  );
  $job$
);

-- --------------------------------------------------------------------------
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ
-- --------------------------------------------------------------------------
--
-- Сразу — что задания на месте и адрес полный:
--
--   SELECT jobname, schedule, active,
--          command LIKE '%.supabase.co/%' AS адрес_полный,
--          command LIKE '%ТВОЙ_%'         AS заглушка_осталась,
--          command LIKE '%sb_secret%'     AS служебный_ключ_в_базе
--   FROM cron.job ORDER BY jobname;
--
-- Последний столбец должен быть `false` у обоих заданий: ключ от всей базы
-- в `cron.job` — это то, что здесь и чинится.
--
-- Через час — что запуски пошли успешные. До этой правки строка была одна:
-- 718 × failed. Если и после правки `succeeded` не появляется, дело не в
-- адресе:
--
--   SELECT status, count(*), max(start_time)
--   FROM cron.job_run_details
--   WHERE start_time > now() - interval '2 hours'
--   GROUP BY status;
