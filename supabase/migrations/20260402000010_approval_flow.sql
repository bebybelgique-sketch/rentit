-- =============================================
-- RentIt: Approval flow
-- pending_approval → pending_payment → confirmed → active → completed
--                  → rejected
--                  → expired (owner didn't respond in 24h)
--                  → payment_expired (renter didn't pay in 2h)
-- =============================================

-- Add new enum values
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'pending_payment';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'payment_expired';

-- Add columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS request_message text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Update availability trigger: only block on actively-reserved statuses
-- pending_approval is NOT blocking (multiple requests for same dates are allowed)
CREATE OR REPLACE FUNCTION public.check_item_availability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE item_id = NEW.item_id
      AND id != NEW.id
      AND status IN ('pending_payment', 'confirmed', 'active')
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Item is not available for the selected dates';
  END IF;
  RETURN NEW;
END;
$$;

-- Update get_booked_dates: only show actually-blocked ranges to calendar
CREATE OR REPLACE FUNCTION public.get_booked_dates(p_item_id uuid)
RETURNS TABLE(start_date date, end_date date) LANGUAGE sql STABLE AS $$
  SELECT start_date, end_date
  FROM public.bookings
  WHERE item_id = p_item_id
    AND status IN ('pending_payment', 'confirmed', 'active')
$$;

-- RLS: renters can insert pending_approval bookings (existing insert policy covers this)
-- Owners need to update pending_approval → pending_payment/rejected
-- This is already covered by existing "Owner/renter can update booking" policy

-- Index for expiry cron queries
CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON public.bookings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_approved_at ON public.bookings(approved_at) WHERE approved_at IS NOT NULL;
