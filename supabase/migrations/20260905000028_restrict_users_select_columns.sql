-- Restore column-level privacy after the client privilege grant migration.
REVOKE SELECT ON public.users FROM anon, authenticated;

GRANT SELECT (
  id,
  full_name,
  avatar_url,
  phone_verified,
  village,
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

REVOKE SELECT (phone, lat, lng) ON public.users FROM anon, authenticated;
