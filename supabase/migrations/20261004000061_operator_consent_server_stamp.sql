-- Отметку согласия владельца на работу с оператором ставит СЕРВЕР, и рядом
-- хранится версия текста, под которым стояла галка.
--
-- ЗАЧЕМ. Миграция 56 сделала items.operator_terms_accepted_at обязательной
-- при цене оператора, но писал её браузер: new Date().toISOString() в
-- ListItem и EditItem. CHECK пропускал любое число — метка, которую
-- присылает клиент, не доказывает ни момента, ни самого согласия. И не
-- было сказано, С ЧЕМ человек согласился: текст галки живёт в словарях
-- (listItem.operatorConsent) и может поменяться. Аудит 04.10 (Codex, GLM):
-- now() на сервере плюс идентификатор редакции текста — тогда вопрос юристу
-- будет о содержании согласия, а не о фальшивом реквизите.
--
-- КАК.
-- * operator_terms_version — редакция текста галки. Допустимые значения
--   перечислены в CHECK; новая редакция текста = новая строка здесь и новая
--   константа в src/domain/operatorTerms.ts.
-- * Триггер ставит operator_terms_accepted_at сам, что бы ни прислал
--   клиент: now() при новом согласии или новой редакции; прежнюю дату, если
--   редакция та же (правка цены или описания согласия не обновляет).
--   Нет цены оператора — нет и согласия: обе колонки обнуляются.
-- * Сборки сайта до этой миграции присылают только метку времени, без
--   версии. Они показывали ровно редакцию 2026-10-03 (текст не менялся с
--   миграции 56) — её триггер и подставляет. Так выкат базы раньше сайта
--   ничего не ломает.
--
-- Живая проверка: supabase/tests/operator_consent.sql.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS operator_terms_version text;

COMMENT ON COLUMN public.items.operator_terms_version IS
  'Редакция текста согласия (listItem.operatorConsent), под которой владелец поставил галку. Новая редакция — новое значение в items_operator_terms_version_known и в src/domain/operatorTerms.ts.';

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_operator_terms_version_known;
ALTER TABLE public.items
  ADD CONSTRAINT items_operator_terms_version_known
    CHECK (operator_terms_version IS NULL OR operator_terms_version IN ('2026-10-03'));

-- Согласия, данные до версий, — под единственной существовавшей редакцией.
UPDATE public.items
   SET operator_terms_version = '2026-10-03'
 WHERE operator_terms_accepted_at IS NOT NULL
   AND operator_terms_version IS NULL;

CREATE OR REPLACE FUNCTION public.items_stamp_operator_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.operator_fee_per_day IS NULL THEN
    NEW.operator_terms_accepted_at := NULL;
    NEW.operator_terms_version := NULL;
    RETURN NEW;
  END IF;

  -- Сборка без версий: метка времени есть, редакции нет.
  IF NEW.operator_terms_version IS NULL AND NEW.operator_terms_accepted_at IS NOT NULL THEN
    NEW.operator_terms_version := '2026-10-03';
  END IF;

  IF NEW.operator_terms_version IS NULL THEN
    -- Галки нет — и метки нет; CHECK ниже такую строку отклонит.
    NEW.operator_terms_accepted_at := NULL;
  ELSIF TG_OP = 'UPDATE'
        AND OLD.operator_terms_accepted_at IS NOT NULL
        AND OLD.operator_terms_version IS NOT DISTINCT FROM NEW.operator_terms_version THEN
    NEW.operator_terms_accepted_at := OLD.operator_terms_accepted_at;
  ELSE
    NEW.operator_terms_accepted_at := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS items_stamp_operator_terms ON public.items;
CREATE TRIGGER items_stamp_operator_terms
  BEFORE INSERT OR UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.items_stamp_operator_terms();

-- Согласие — это и момент, и редакция.
ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_operator_needs_consent;
ALTER TABLE public.items
  ADD CONSTRAINT items_operator_needs_consent
    CHECK (operator_fee_per_day IS NULL
           OR (operator_terms_accepted_at IS NOT NULL AND operator_terms_version IS NOT NULL));
