-- =============================================
-- RentIt: Lock down bookings INSERT
-- =============================================
-- The "Renters can insert bookings" policy allowed any authenticated
-- client to INSERT a booking directly with arbitrary prices, status,
-- dates, etc. — bypassing the create-rental-intent edge function that
-- validates availability, computes fees, and creates the Stripe PI.
--
-- Booking creation goes exclusively through create-rental-intent
-- (service role), which bypasses RLS. Direct client INSERT is now
-- fully blocked.
-- =============================================

DROP POLICY IF EXISTS "Renters can insert bookings" ON public.bookings;
