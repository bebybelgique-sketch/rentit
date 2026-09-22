-- =============================================
-- Миграция 40: подписки на push-уведомления
-- =============================================
--
-- ЗАЧЕМ. Владелец узнаёт о заявке, только открыв приложение, а у заявки
-- сутки на ответ. Арендатор узнаёт об ответе так же. Push доходит, когда
-- приложение закрыто. Тексты и правила — пакет Claude Design «Rentit Push
-- Permission» (22.09.2026); разбор отступлений — в
-- supabase/functions/_shared/pushCopy.ts.
--
-- ── ПОЧЕМУ КЛИЕНТУ ЗДЕСЬ НЕЛЬЗЯ НИЧЕГО ───────────────────────────────
--
-- Первым оператором у каждой таблицы идёт `revoke all … from anon,
-- authenticated`. Это не перестраховка, а урок миграции 34: умолчание
-- Supabase выдаёт НОВОЙ таблице все права клиентским ролям, и `grant
-- insert` без предшествующего revoke ничего не сужает. Живая база тогда
-- ответила GET → 200, PATCH → 204, DELETE → 204.
--
-- Подписка пишется и читается только функцией push-subscription под
-- service_role, после проверки того, чей это вход. Прямой доступ клиента
-- дал бы ему чужие адреса подписок, а адрес подписки — это ключ, по
-- которому человеку можно слать сообщения.
--
-- Запрет записан ещё и правилом в scripts/check-migration-grants.mjs:
-- выданный клиенту грант на эти таблицы уронит CI, а не останется
-- незамеченным.
--
-- ── ОДИН АДРЕС — ОДИН ЧЕЛОВЕК ────────────────────────────────────────
--
-- Первичный ключ — сам адрес. Вышел Андре и вошла Мари на том же
-- компьютере — подписка переходит к Мари, а не остаётся у обоих: иначе
-- Андре получал бы её уведомления на чужом устройстве. Удаление учётки
-- снимает подписки каскадом (users → auth.users тоже on delete cascade).
-- =============================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint   text PRIMARY KEY CHECK (endpoint LIKE 'https://%'),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  -- Язык ЭТОГО устройства: уведомление собирает сервер, и словарей
  -- приложения у него нет. Меняется, когда человек переключает язык.
  lang       text NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr', 'nl', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id, updated_at DESC);

-- Политик нет намеренно: клиенту здесь не положено ничего, а service_role
-- обходит RLS. Включённый RLS без политик — второй замок на ту же дверь.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.push_subscriptions IS
  'Подписки браузеров на push. Пишет и читает только функция push-subscription (service_role). Один адрес — один человек.';

-- =============================================
-- Отметки «уведомление по событию уже ушло»
-- =============================================
--
-- ЗАЧЕМ. Сообщения в переписке пишет сам клиент, прямо в
-- booking_messages, и серверного события у сообщения нет. Поэтому после
-- отправки клиент зовёт функцию notify-message. Её можно позвать
-- повторно — и тогда собеседник получил бы то же уведомление ещё раз.
--
-- Отметка ставится вставкой по уникальному ключу `message:<id>`: вторая
-- вставка упирается в ключ, и повтора нет. Одно сообщение — одно
-- уведомление, как бы ни звали функцию.
--
-- ПОЧЕМУ НЕ КОЛОНКА В booking_messages. У клиента есть INSERT на эту
-- таблицу — он сам проставил бы колонку в своём же сообщении. Отдельная
-- таблица закрыта от него целиком.
--
-- Старые отметки бесполезны: сообщению старше пяти минут функция
-- уведомление не шлёт вовсе. Она же и подчищает отметки старше суток.

CREATE TABLE IF NOT EXISTS public.push_sent (
  event_key text PRIMARY KEY,
  sent_at   timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.push_sent FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.push_sent TO service_role;

ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.push_sent IS
  'Одно событие — одно уведомление. Ключ вида message:<id>. Только service_role.';

-- =============================================
-- ПРОВЕРКА ПОСЛЕ ВЫКАТА (ключ anon; должно быть 401 на обе):
--   GET /rest/v1/push_subscriptions?select=endpoint&limit=1
--   GET /rest/v1/push_sent?select=event_key&limit=1
-- =============================================
