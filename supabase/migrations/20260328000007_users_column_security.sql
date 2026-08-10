-- =============================================
-- RentIt: Column-level security for users table
-- =============================================
-- Hide phone_otp, phone_otp_expires_at, stripe_customer_id from
-- anon and authenticated roles. These columns are server-side only
-- (used by edge functions via service role) and must never be
-- exposed to client queries.
--
-- PostgREST respects column-level grants: SELECT * from the JS
-- client will return only the columns listed below, silently
-- omitting the hidden ones.
-- =============================================

-- Step 1: Drop the blanket table-level SELECT grant
REVOKE SELECT ON public.users FROM anon, authenticated;

-- Step 2: Grant SELECT on every safe column explicitly
GRANT SELECT (
  id,
  full_name,
  avatar_url,
  phone,
  phone_verified,
  village,
  lat,
  lng,
  role,
  referral_code,
  referred_by,
  rating_as_owner,
  rating_as_renter,
  is_pro,
  pro_expires_at,
  business_name,
  business_plan,
  business_plan_expires_at,
  created_at
) ON public.users TO anon, authenticated;

-- INSERT / UPDATE / DELETE remain unrestricted at column level
-- (row-level RLS policies handle those)
