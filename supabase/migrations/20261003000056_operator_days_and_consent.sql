-- =============================================
-- 56. Оператор: дни работы — явно; согласие владельца
-- =============================================
--
-- Три внешних ревью 03.10 (Codex, GLM, GPT) о #151 сошлись в двух местах.
--
-- 1. «ЦЕНА × ДНИ» — КАКИЕ ДНИ? До этой миграции — все календарные дни
--    брони. Но выходные сб–пн — это пакет с возвратом в понедельник утром:
--    оператор работает два дня, а платить пришлось бы за три. И неделя
--    аренды с оператором только на первый день не выражалась вовсе. Цена
--    аренды оптимизируется тарифами, а работа оператора — это дни его
--    работы (GPT: «1 оплачиваемый день оператора = один календарный день,
--    в который оператор фактически оказывает услугу»).
--
--    Теперь арендатор называет число дней с оператором в заявке (от 1 до
--    длины брони; по умолчанию — вся бронь), и оно ложится снимком рядом с
--    суммой: bookings.operator_days. operator_fee = цена за день × эти дни.
--    Даты брони в продукте не меняются (ни встречного предложения, ни
--    правки нет), поэтому снимок не «отклеится» от дат; база всё равно
--    держит operator_days в пределах длины брони.
--
-- 2. ГРАНИЦА ДО ПУБЛИЧНОГО ВКЛЮЧЕНИЯ. С оператором владелец уже оказывает
--    услугу на участке арендатора: другая ответственность и страховка.
--    Пока юрист не посмотрел условия, владелец, включающий оператора,
--    подтверждает, что застрахован и отвечает за своё вмешательство —
--    items.operator_terms_accepted_at, момент подтверждения. Без него цена
--    оператора не сохраняется: это правило базы, а не только формы.
-- =============================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS operator_days int;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_operator_days_consistent;

-- CASE, а не «A OR B»: при operator_days = NULL выражение
-- «operator_requested AND operator_days BETWEEN …» даёт NULL, а NULL в CHECK
-- считается «прошло». Первая редакция так и пропускала оператора без дней —
-- поймал предполёт на живой базе.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_operator_days_consistent CHECK (
    CASE WHEN operator_requested
      THEN operator_days IS NOT NULL AND operator_days BETWEEN 1 AND (end_date - start_date + 1)
      ELSE operator_days IS NULL
    END
  );

COMMENT ON COLUMN public.bookings.operator_days IS
  'Снимок: сколько дней работает оператор (от 1 до длины брони). NULL — оператора не просили.';
COMMENT ON COLUMN public.bookings.operator_fee IS
  'Снимок суммы за оператора на момент заявки, евро: цена за день × operator_days. В total_price НЕ входит — отдельная услуга, расчёт на месте.';

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS operator_terms_accepted_at timestamptz;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_operator_needs_consent;

ALTER TABLE public.items
  ADD CONSTRAINT items_operator_needs_consent
    CHECK (operator_fee_per_day IS NULL OR operator_terms_accepted_at IS NOT NULL);

COMMENT ON COLUMN public.items.operator_terms_accepted_at IS
  'Когда владелец подтвердил, что застрахован для работы с оператором и отвечает за своё вмешательство на участке арендатора. Обязателен при непустой operator_fee_per_day.';
