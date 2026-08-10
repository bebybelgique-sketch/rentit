-- Pro subscription fields on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_pro           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
