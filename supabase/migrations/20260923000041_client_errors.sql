-- 41. Отчёты о поломках в браузерах людей.
--
-- ЗАЧЕМ. До сих пор о поломке у чужого человека владелец продукта не
-- узнавал никак. Журнал на устройстве (src/lib/errorLog.ts) давал человеку
-- кнопку «скопировать подробности» — но переслать их догадывается один из
-- ста, а остальные молча уходят. Отчёт уходит на сервер сам.
--
-- ЧТО ХРАНИТСЯ — И ЧЕГО НЕТ.
--   Хранится: вид поломки, текст (телефоны и адреса почты замаскированы
--   ещё в функции), след стека, путь страницы БЕЗ параметров, версия
--   сборки, строка браузера, язык.
--   НЕТ: кто это был (ни user_id, ни IP), содержимого форм, параметров
--   адреса (в ссылках из писем бывают одноразовые токены).
--   Чинить поломку помогает «где и что», а не «у кого».
--
-- ОДНА СТРОКА НА ПОЛОМКУ В ДЕНЬ. Отпечаток — хеш вида, текста без чисел и
-- первой строки стека. Тысяча одинаковых падений — одна строка со
-- счётчиком 1000, а не тысяча строк: таблица растёт по числу РАЗНЫХ
-- поломок, и посмотреть на неё можно глазами.
--
-- ПОТОЛОК. Приём открыт для анонима — поломки до входа важны не меньше, —
-- значит мусор может слать кто угодно. Больше 500 разных отпечатков за
-- день не принимается; повторы уже известных считаются всегда.
--
-- СРОК — 30 ДНЕЙ, и следит за ним сама функция приёма: ручной шаг
-- «не забыть почистить» однажды не делается.

CREATE TABLE IF NOT EXISTS public.client_errors (
  fingerprint text        NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{16,64}$'),
  day         date        NOT NULL DEFAULT current_date,
  kind        text        NOT NULL CHECK (kind IN ('render', 'promise', 'window')),
  message     text        NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  stack       text                 CHECK (length(stack) <= 2000),
  path        text        NOT NULL CHECK (path LIKE '/%' AND length(path) <= 200),
  release     text                 CHECK (length(release) <= 40),
  user_agent  text                 CHECK (length(user_agent) <= 300),
  lang        text                 CHECK (lang IN ('fr', 'nl', 'en')),
  count       integer     NOT NULL DEFAULT 1 CHECK (count >= 1),
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fingerprint, day)
);

-- Умолчания Supabase выдают новой таблице ВСЕ права для anon и
-- authenticated (см. docs/table-privileges-2026-09-18.md). Снимаем первым
-- делом: пишет в таблицу только функция report-error, читает — только
-- admin-action.
REVOKE ALL ON public.client_errors FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_errors_day ON public.client_errors (day);
CREATE INDEX IF NOT EXISTS idx_client_errors_last_seen ON public.client_errors (last_seen DESC);

COMMENT ON TABLE public.client_errors IS
  'Поломки в браузерах людей: одна строка на отпечаток в день. Без user_id и IP. Пишет report-error, читает admin-action (service_role). Хранится 30 дней.';

-- Приём одного отчёта. Всё — одной функцией, чтобы «посчитать повтор»,
-- «не превысить потолок» и «убрать старое» были одним решением, а не
-- тремя запросами из функции с гонкой между ними.
--
-- SECURITY INVOKER намеренно: права — у вызывающего, то есть у
-- service_role. Вызванная анонимом, функция упрётся в снятые права на
-- таблицу; EXECUTE снят с них вдобавок.
--
-- Возвращает: 'new' — поломка новая сегодня; 'repeat' — счётчик вырос;
-- 'capped' — потолок дня исчерпан, новый отпечаток не принят.
CREATE OR REPLACE FUNCTION public.record_client_error(
  p_fingerprint text,
  p_kind        text,
  p_message     text,
  p_stack       text,
  p_path        text,
  p_release     text,
  p_user_agent  text,
  p_lang        text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  today_rows integer;
BEGIN
  DELETE FROM public.client_errors WHERE day < current_date - 30;

  UPDATE public.client_errors
     SET count = count + 1, last_seen = now()
   WHERE fingerprint = p_fingerprint AND day = current_date;
  IF FOUND THEN
    RETURN 'repeat';
  END IF;

  SELECT count(*) INTO today_rows FROM public.client_errors WHERE day = current_date;
  IF today_rows >= 500 THEN
    RETURN 'capped';
  END IF;

  INSERT INTO public.client_errors (fingerprint, kind, message, stack, path, release, user_agent, lang)
  VALUES (p_fingerprint, p_kind, p_message, p_stack, p_path, p_release, p_user_agent, p_lang)
  -- Два одинаковых отчёта одновременно: второй не падает, а считается.
  ON CONFLICT (fingerprint, day)
  DO UPDATE SET count = public.client_errors.count + 1, last_seen = now();
  RETURN 'new';
END;
$$;

REVOKE ALL ON FUNCTION public.record_client_error(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error(text, text, text, text, text, text, text, text) TO service_role;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ (на живой базе, не на веру):
--   анонимный GET /rest/v1/client_errors            → 401, 42501
--   анонимный POST /rest/v1/rpc/record_client_error → отказ (42501)
