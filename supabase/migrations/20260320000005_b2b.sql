-- B2B Desk fields on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS business_name         text,
  ADD COLUMN IF NOT EXISTS business_plan         text CHECK (business_plan IN ('starter', 'growth', 'enterprise')),
  ADD COLUMN IF NOT EXISTS business_plan_expires_at timestamptz;

-- items: flag for business listings
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS is_business boolean NOT NULL DEFAULT false;
