-- =============================================
-- 54. Аренда с оператором — объявленная услуга владельца
-- =============================================
--
-- ЗАЧЕМ. Мини-экскаватор, виброплита, автовышка — техника, которую частный
-- человек сам не поведёт. Прокатчики в Бельгии сдают её и «sans opérateur»,
-- и «avec opérateur» (сверено 03.10.2026): mini-pelle 1,2 t avec opérateur
-- ≈ 250 € la journée; 2,5 t — 500 € HTVA la journée; часто — по часам
-- поверх дневной аренды (45–70 € / h, minimum 3 h). Настоящее объявление
-- 03.10 так и писало: «Tarifs sans opérateur» — то есть с оператором
-- дороже. В продукте выразить это было нечем.
--
-- ПОЧЕМУ ЗА ДЕНЬ, А НЕ ЗА ЧАС. Бронь у нас — даты, без часов (о времени
-- стороны договариваются в переписке), и посчитать часы оператора нечем.
-- Владелец называет цену оператора за день — надбавку к аренде вещи.
--
-- ТЕ ЖЕ ПРАВИЛА, ЧТО У ДОСТАВКИ (миграция 24):
--   • один источник правды — items.operator_fee_per_day; NULL — услуги нет;
--   • ноль запрещён: «0 € за оператора» — опечатка или подарок;
--   • в бронь — СНИМОК суммы на момент заявки (bookings.operator_fee =
--     цена за день × дни), а не ссылка на вещь: завтрашняя правка цены не
--     меняет вчерашней договорённости;
--   • в total_price НЕ входит — отдельная услуга, деньги идут мимо
--     платформы, расчёт на месте;
--   • заполняет обе колонки брони только request-rental сервисным ключом
--     — из вещи, а не из тела запроса.
--
-- Права: items — табличный грант клиента (храповик), новый столбец под
-- ним; bookings — клиент только читает, пишет сервер.
-- =============================================

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS operator_fee_per_day numeric(10,2);

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_operator_fee_positive;

ALTER TABLE public.items
  ADD CONSTRAINT items_operator_fee_positive CHECK (operator_fee_per_day IS NULL OR operator_fee_per_day > 0);

COMMENT ON COLUMN public.items.operator_fee_per_day IS
  'Надбавка за оператора (владелец сам ведёт технику), евро за день аренды. NULL — услуги нет, и это единственный признак её включённости. Расчёт между сторонами на месте.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS operator_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operator_fee numeric(10,2);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_operator_snapshot_consistent;

-- Попросили оператора — снимок суммы обязан быть; не просили — не должно.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_operator_snapshot_consistent
    CHECK (operator_requested = (operator_fee IS NOT NULL));

COMMENT ON COLUMN public.bookings.operator_requested IS
  'Арендатор попросил оператора при заявке. Существующие брони — false: услуги в продукте не было.';
COMMENT ON COLUMN public.bookings.operator_fee IS
  'Снимок суммы за оператора на всю бронь (цена за день × дни) на момент заявки, евро. В total_price НЕ входит — отдельная услуга, расчёт на месте.';
