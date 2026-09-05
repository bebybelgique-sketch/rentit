-- Edge Functions use service_role and need table privileges in addition to RLS bypass.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_blackouts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_log TO service_role;
