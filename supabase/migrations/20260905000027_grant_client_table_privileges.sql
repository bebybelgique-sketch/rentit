-- Grant PostgREST roles the table privileges required by the existing RLS policies.
-- RLS remains the row-level boundary; these grants only make the policy checks reachable.
GRANT SELECT ON public.users, public.items, public.bookings, public.reviews TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT INSERT ON public.bookings TO authenticated;
GRANT UPDATE ON public.bookings TO authenticated;
GRANT INSERT ON public.reviews TO authenticated;
