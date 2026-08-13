-- 20260813000019_rate_tiers_and_late_fee.sql
--
-- ЧТО ЭТО ДОБАВЛЯЕТ
--
-- 1. Тарифы на срок. До сих пор у объявления была одна цена — за день.
--    Основной случай аренды инструмента — выходные и неделя, и выразить
--    «40 € за три дня, 70 € за неделю» было нечем: владелец либо терял на
--    длинных сроках, либо писал цену словами в описании, где её не видит ни
--    расчёт, ни бронь.
--
-- 2. Плата за просрочку. Английские условия обещают её с апреля
--    («Late returns may result in additional charges equivalent to the daily
--    rate for each additional day»), французские молчат, а продукт не знал
--    о ней вовсе. Это одна из находок разбора условий от 13.08.
--
-- ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ. Платформа денег не держит и не считает долгов:
-- ни одно из этих чисел никуда не списывается и ничем не удерживается. Это
-- РАСКРЫТИЕ условия, а не расчётный механизм — цифра, которую владелец
-- объявляет заранее, чтобы при встрече не спорить. Сумма просрочки в
-- `bookings` не пишется: продукт не знает момента фактического возврата,
-- и записать он мог бы только выдумку.
--
-- Все три столбца необязательны. Пустое значение — «тарифа нет», и расчёт
-- тогда идёт по дневной цене, ровно как раньше.
--
-- Применять как остальные миграции проекта:
--   npx supabase db query --linked < supabase/migrations/20260813000019_rate_tiers_and_late_fee.sql
-- (`supabase db push` СЛОМАЕТ базу: `schema_migrations` пуста для всех
-- миграций, их применяли вручную.)

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS price_3days      numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_week       numeric(10,2),
  ADD COLUMN IF NOT EXISTS late_fee_per_day numeric(10,2);

-- Ноль и отрицательные значения запрещены, а не приводятся к NULL молча:
-- «0 € за неделю» — это либо опечатка, либо подарок, и в обоих случаях
-- владелец должен увидеть отказ, а не обнаружить последствия в брони.
ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_price_3days_positive,
  DROP CONSTRAINT IF EXISTS items_price_week_positive,
  DROP CONSTRAINT IF EXISTS items_late_fee_positive;

ALTER TABLE public.items
  ADD CONSTRAINT items_price_3days_positive CHECK (price_3days      IS NULL OR price_3days      > 0),
  ADD CONSTRAINT items_price_week_positive  CHECK (price_week       IS NULL OR price_week       > 0),
  ADD CONSTRAINT items_late_fee_positive    CHECK (late_fee_per_day IS NULL OR late_fee_per_day > 0);

COMMENT ON COLUMN public.items.price_3days IS
  'Цена за пакет из 3 дней, евро. NULL — тарифа нет. Расчёт берёт самое дешёвое сочетание пакетов и дней (supabase/functions/_shared/pricing.ts).';
COMMENT ON COLUMN public.items.price_week IS
  'Цена за пакет из 7 дней, евро. NULL — тарифа нет.';
COMMENT ON COLUMN public.items.late_fee_per_day IS
  'Объявленная владельцем плата за каждый день просрочки, евро. Платформа её НЕ считает и НЕ удерживает: это раскрытие условия, расчёт между сторонами наличными.';

-- --------------------------------------------------------------------------
-- Чего здесь НЕТ и почему
-- --------------------------------------------------------------------------
--
-- `browse_items` (геопоиск витрины) перечисляет столбцы поимённо и новых не
-- отдаёт — это сделано осознанно. Карточка витрины остаётся с дневной ценой:
-- на плитке 200 px три тарифа превращаются в кашу, а сравнивать вещи между
-- собой удобнее по одному числу. Тарифы показываются на странице вещи, где
-- человек уже выбирает даты и видит итог целиком.
--
-- Понадобится на витрине — правится в миграции PostGIS от 12.08, там же
-- определение функции.
