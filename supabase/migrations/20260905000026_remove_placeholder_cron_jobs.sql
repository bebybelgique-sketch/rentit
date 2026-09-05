-- Remove cron jobs that were created from the template placeholders.
-- Valid jobs with project-specific URLs and tokens are left untouched.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'expire-bookings'
      AND command LIKE '%<PROJECT_REF>%'
  ) THEN
    PERFORM cron.unschedule('expire-bookings');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-orphan-photos'
      AND command LIKE '%<PROJECT_REF>%'
  ) THEN
    PERFORM cron.unschedule('cleanup-orphan-photos');
  END IF;
END
$$;
