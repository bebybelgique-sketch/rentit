-- =============================================
-- RentIt: статус брони меняет только сервер
--
-- Политики "Owner can progress booking status" и "Renter can cancel own
-- bookings" разрешали браузеру писать status напрямую. Пока они живы,
-- машина состояний в transition-booking обходится одним запросом из
-- консоли: владелец переводил бронь в completed, минуя передачу и
-- возврат, и тем самым открывал себе право на взаимный отзыв.
--
-- Обе edge-функции (respond-to-request, transition-booking) ходят под
-- service role и RLS не подчиняются, поэтому переходы продолжают
-- работать. Клиенту остаётся чтение.
-- =============================================

DROP POLICY IF EXISTS "Owner can progress booking status" ON public.bookings;
DROP POLICY IF EXISTS "Renter can cancel own bookings"    ON public.bookings;

REVOKE UPDATE ON public.bookings FROM authenticated;

-- Политики на чтение ("Renters see own bookings", "Owners see bookings on
-- their items") намеренно оставлены: стороны обязаны видеть свою сделку.
