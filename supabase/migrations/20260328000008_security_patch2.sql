-- =============================================
-- RentIt: Security patch 2
-- =============================================
-- Fixes:
--   1. CRITICAL  phone_otp bypass via direct UPDATE
--   2. HIGH      confirmed → completed allowed without active step
--   3. HIGH      bookings: missing frozen fields (dates, fees, stripe PI)
--   4. MEDIUM    category remap ran only if enum — now always idempotent
--   Side-fix:    stripe_customer_id removed from RLS subquery (authenticated
--                can't SELECT it after migration 7, causing profile saves to
--                fail for users who already have a Stripe customer ID)
-- =============================================

-- ---- 1. Column-level UPDATE revoke for server-only columns ----
-- Service role (edge functions) bypasses these; authenticated clients cannot
-- write phone_otp, phone_otp_expires_at, or stripe_customer_id directly.
REVOKE UPDATE (phone_otp, phone_otp_expires_at, stripe_customer_id)
  ON public.users FROM anon, authenticated;

-- ---- 2. Rebuild users UPDATE policy ----
-- Remove stripe_customer_id subquery (authenticated can't SELECT it after
-- migration 7 — the subquery returned NULL, breaking saves for users who
-- already have a Stripe customer ID). It is now protected by the REVOKE above.
DROP POLICY IF EXISTS "Users can update own safe fields" ON public.users;

CREATE POLICY "Users can update own safe fields" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role                  = (SELECT u.role                  FROM public.users u WHERE u.id = auth.uid())
    AND phone_verified        = (SELECT u.phone_verified        FROM public.users u WHERE u.id = auth.uid())
    AND is_pro                = (SELECT u.is_pro                FROM public.users u WHERE u.id = auth.uid())
    AND (business_plan            IS NOT DISTINCT FROM (SELECT u.business_plan            FROM public.users u WHERE u.id = auth.uid()))
    AND (business_plan_expires_at IS NOT DISTINCT FROM (SELECT u.business_plan_expires_at FROM public.users u WHERE u.id = auth.uid()))
    AND (referred_by              IS NOT DISTINCT FROM (SELECT u.referred_by              FROM public.users u WHERE u.id = auth.uid()))
    AND (rating_as_owner          IS NOT DISTINCT FROM (SELECT u.rating_as_owner          FROM public.users u WHERE u.id = auth.uid()))
    AND (rating_as_renter         IS NOT DISTINCT FROM (SELECT u.rating_as_renter         FROM public.users u WHERE u.id = auth.uid()))
    -- phone_otp / phone_otp_expires_at / stripe_customer_id:
    -- protected by column-level UPDATE REVOKE above, not repeated here
  );

-- ---- 3. Rebuild bookings UPDATE policies ----
DROP POLICY IF EXISTS "Renter can cancel own bookings"    ON public.bookings;
DROP POLICY IF EXISTS "Owner can progress booking status" ON public.bookings;

-- Renter: can only set status = 'cancelled'; all financial + date fields frozen.
CREATE POLICY "Renter can cancel own bookings" ON public.bookings
  FOR UPDATE
  USING (
    auth.uid() = renter_id
    AND status IN ('pending_payment', 'confirmed')
  )
  WITH CHECK (
    auth.uid() = renter_id
    AND status = 'cancelled'
    -- frozen immutable fields
    AND total_price        = (SELECT b.total_price        FROM public.bookings b WHERE b.id = bookings.id)
    AND deposit_amount     = (SELECT b.deposit_amount     FROM public.bookings b WHERE b.id = bookings.id)
    AND insurance_amount   = (SELECT b.insurance_amount   FROM public.bookings b WHERE b.id = bookings.id)
    AND platform_fee       = (SELECT b.platform_fee       FROM public.bookings b WHERE b.id = bookings.id)
    AND item_id            = (SELECT b.item_id            FROM public.bookings b WHERE b.id = bookings.id)
    AND renter_id          = (SELECT b.renter_id          FROM public.bookings b WHERE b.id = bookings.id)
    AND start_date         = (SELECT b.start_date         FROM public.bookings b WHERE b.id = bookings.id)
    AND end_date           = (SELECT b.end_date           FROM public.bookings b WHERE b.id = bookings.id)
    AND deposit_returned   = (SELECT b.deposit_returned   FROM public.bookings b WHERE b.id = bookings.id)
    AND (amount_paid                IS NOT DISTINCT FROM (SELECT b.amount_paid                FROM public.bookings b WHERE b.id = bookings.id))
    AND (stripe_payment_intent_id   IS NOT DISTINCT FROM (SELECT b.stripe_payment_intent_id   FROM public.bookings b WHERE b.id = bookings.id))
  );

-- Owner: strict transitions only — confirmed→active OR active→completed.
-- Jumping confirmed→completed is blocked.
CREATE POLICY "Owner can progress booking status" ON public.bookings
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND owner_id = auth.uid())
    AND status IN ('confirmed', 'active')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND owner_id = auth.uid())
    -- enforce one-step transitions
    AND (
      (status = 'active'    AND (SELECT b.status FROM public.bookings b WHERE b.id = bookings.id) = 'confirmed')
      OR
      (status = 'completed' AND (SELECT b.status FROM public.bookings b WHERE b.id = bookings.id) = 'active')
    )
    -- frozen immutable fields
    AND total_price        = (SELECT b.total_price        FROM public.bookings b WHERE b.id = bookings.id)
    AND deposit_amount     = (SELECT b.deposit_amount     FROM public.bookings b WHERE b.id = bookings.id)
    AND insurance_amount   = (SELECT b.insurance_amount   FROM public.bookings b WHERE b.id = bookings.id)
    AND platform_fee       = (SELECT b.platform_fee       FROM public.bookings b WHERE b.id = bookings.id)
    AND item_id            = (SELECT b.item_id            FROM public.bookings b WHERE b.id = bookings.id)
    AND renter_id          = (SELECT b.renter_id          FROM public.bookings b WHERE b.id = bookings.id)
    AND start_date         = (SELECT b.start_date         FROM public.bookings b WHERE b.id = bookings.id)
    AND end_date           = (SELECT b.end_date           FROM public.bookings b WHERE b.id = bookings.id)
    AND deposit_returned   = (SELECT b.deposit_returned   FROM public.bookings b WHERE b.id = bookings.id)
    AND (amount_paid                IS NOT DISTINCT FROM (SELECT b.amount_paid                FROM public.bookings b WHERE b.id = bookings.id))
    AND (stripe_payment_intent_id   IS NOT DISTINCT FROM (SELECT b.stripe_payment_intent_id   FROM public.bookings b WHERE b.id = bookings.id))
  );

-- ---- 4. Category remap — idempotent, runs regardless of column type ----
-- Migration 6 only ran these inside the IF (enum check), so they were skipped
-- on any env where the column was already text. Safe to re-run: no-op if
-- legacy values are absent.
UPDATE public.items SET category = 'other'
  WHERE category IN ('sports', 'electronics', 'kids', 'home', 'vehicles', 'clothing');
UPDATE public.items SET category = 'hand_tools'
  WHERE category = 'tools';
