-- =============================================
-- RentIt: Security fixes
-- =============================================

-- ---- 1. USERS: fix privilege-escalation via UPDATE ----
-- Drop the old open policy that let users change role/is_pro/phone_verified/etc.
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- New policy: users can only change safe profile fields.
-- The WITH CHECK prevents changing role, is_pro, phone_verified, stripe_customer_id,
-- business_plan, referred_by, and rating columns.
CREATE POLICY "Users can update own safe fields" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Immutable privilege fields must not change
    AND role              = (SELECT u.role              FROM public.users u WHERE u.id = auth.uid())
    AND phone_verified    = (SELECT u.phone_verified    FROM public.users u WHERE u.id = auth.uid())
    AND is_pro            = (SELECT u.is_pro            FROM public.users u WHERE u.id = auth.uid())
    AND (stripe_customer_id   IS NOT DISTINCT FROM (SELECT u.stripe_customer_id   FROM public.users u WHERE u.id = auth.uid()))
    AND (business_plan        IS NOT DISTINCT FROM (SELECT u.business_plan        FROM public.users u WHERE u.id = auth.uid()))
    AND (business_plan_expires_at IS NOT DISTINCT FROM (SELECT u.business_plan_expires_at FROM public.users u WHERE u.id = auth.uid()))
    AND (referred_by          IS NOT DISTINCT FROM (SELECT u.referred_by          FROM public.users u WHERE u.id = auth.uid()))
    AND (rating_as_owner      IS NOT DISTINCT FROM (SELECT u.rating_as_owner      FROM public.users u WHERE u.id = auth.uid()))
    AND (rating_as_renter     IS NOT DISTINCT FROM (SELECT u.rating_as_renter     FROM public.users u WHERE u.id = auth.uid()))
  );

-- ---- 2. BOOKINGS: prevent arbitrary status/financial manipulation ----
DROP POLICY IF EXISTS "Owner/renter can update booking" ON public.bookings;

-- Renter can only cancel their own bookings that are still pending or confirmed.
-- Financial fields (total_price, deposit_amount, item_id, renter_id) are frozen.
CREATE POLICY "Renter can cancel own bookings" ON public.bookings
  FOR UPDATE
  USING (
    auth.uid() = renter_id
    AND status IN ('pending_payment', 'confirmed')
  )
  WITH CHECK (
    auth.uid() = renter_id
    AND status = 'cancelled'
    AND total_price    = (SELECT b.total_price    FROM public.bookings b WHERE b.id = bookings.id)
    AND deposit_amount = (SELECT b.deposit_amount FROM public.bookings b WHERE b.id = bookings.id)
    AND item_id        = (SELECT b.item_id        FROM public.bookings b WHERE b.id = bookings.id)
    AND renter_id      = (SELECT b.renter_id      FROM public.bookings b WHERE b.id = bookings.id)
  );

-- Owner can only advance status: confirmed → active, active → completed.
-- Cannot touch financial fields.
CREATE POLICY "Owner can progress booking status" ON public.bookings
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND owner_id = auth.uid())
    AND status IN ('confirmed', 'active')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.items WHERE id = item_id AND owner_id = auth.uid())
    AND status IN ('active', 'completed')
    AND total_price    = (SELECT b.total_price    FROM public.bookings b WHERE b.id = bookings.id)
    AND deposit_amount = (SELECT b.deposit_amount FROM public.bookings b WHERE b.id = bookings.id)
    AND item_id        = (SELECT b.item_id        FROM public.bookings b WHERE b.id = bookings.id)
    AND renter_id      = (SELECT b.renter_id      FROM public.bookings b WHERE b.id = bookings.id)
  );

-- ---- 3. ITEMS category: migrate from old enum to text + new values ----
-- Cast to text before comparing so we never get "invalid enum value" errors,
-- regardless of which values are currently in the enum.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'category'
      AND udt_name = 'item_category'
  ) THEN
    -- Convert to text FIRST so any string value becomes valid for UPDATE
    ALTER TABLE public.items ALTER COLUMN category DROP DEFAULT;
    ALTER TABLE public.items ALTER COLUMN category TYPE text;
    DROP TYPE IF EXISTS item_category;
    -- Now safe to remap legacy values with plain string comparisons
    UPDATE public.items SET category = 'other'
      WHERE category IN ('sports', 'electronics', 'kids', 'home', 'vehicles', 'clothing');
    UPDATE public.items SET category = 'hand_tools'
      WHERE category = 'tools';
  END IF;
END $$;

-- Drop old check constraint if it exists, then add the correct one
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_category_key;
ALTER TABLE public.items ADD CONSTRAINT items_category_check
  CHECK (category IN ('power_tools', 'hand_tools', 'garden', 'construction', 'cleaning', 'measuring', 'other'));

-- Default must also be valid
ALTER TABLE public.items ALTER COLUMN category SET DEFAULT 'other';
