-- =============================================
-- RentIt: Initial Schema
-- =============================================

-- Users profile (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  phone_verified boolean not null default false,
  phone_otp text,
  phone_otp_expires_at timestamptz,
  village text,
  lat double precision,
  lng double precision,
  role text not null default 'user' check (role in ('user', 'admin')),
  referral_code text unique,
  referred_by uuid references public.users(id),
  rating_as_owner numeric(3,2),
  rating_as_renter numeric(3,2),
  created_at timestamptz not null default now()
);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-generate referral code
create or replace function public.generate_referral_code()
returns trigger language plpgsql as $$
declare
  code text;
begin
  loop
    code := upper(substring(md5(random()::text) from 1 for 8));
    exit when not exists (select 1 from public.users where referral_code = code);
  end loop;
  new.referral_code := code;
  return new;
end;
$$;

drop trigger if exists set_referral_code on public.users;
create trigger set_referral_code
  before insert on public.users
  for each row when (new.referral_code is null)
  execute function public.generate_referral_code();

-- Categories enum
create type item_category as enum (
  'tools', 'sports', 'electronics', 'kids', 'home', 'vehicles', 'clothing', 'other'
);

-- Item condition enum
create type item_condition as enum ('new', 'like_new', 'good', 'fair');

-- Items table
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  category item_category not null default 'other',
  condition item_condition not null default 'good',
  price_per_day numeric(10,2) not null check (price_per_day > 0),
  deposit numeric(10,2) not null default 0 check (deposit >= 0),
  photos jsonb not null default '[]'::jsonb,  -- array of storage URLs
  lat double precision,
  lng double precision,
  address text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

-- Booking status
create type booking_status as enum (
  'pending_payment',
  'confirmed',
  'active',       -- item picked up
  'completed',    -- item returned
  'cancelled',
  'disputed'
);

-- Bookings table
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  renter_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_days int not null generated always as (end_date - start_date + 1) stored,
  total_price numeric(10,2) not null,
  deposit_amount numeric(10,2) not null default 0,
  platform_fee numeric(10,2) not null default 0,
  status booking_status not null default 'pending_payment',
  stripe_payment_intent_id text,
  amount_paid int,               -- in cents
  deposit_returned boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stripe_payment_intent_id text not null unique,
  amount int not null,           -- cents: rental + deposit
  rental_amount int not null,    -- cents
  deposit_amount int not null,   -- cents
  platform_fee int not null,     -- cents (12%)
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  created_at timestamptz not null default now()
);

-- Reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  review_type text not null check (review_type in ('item', 'owner', 'renter')),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(booking_id, from_user_id, review_type)
);

-- RLS
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;

-- Users policies
create policy "Users can read own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
create policy "Public user names/ratings visible" on public.users for select using (true);

-- Items policies
create policy "Items are public" on public.items for select using (true);
create policy "Owners can insert items" on public.items for insert with check (auth.uid() = owner_id);
create policy "Owners can update own items" on public.items for update using (auth.uid() = owner_id);
create policy "Owners can delete own items" on public.items for delete using (auth.uid() = owner_id);

-- Bookings policies
create policy "Renters see own bookings" on public.bookings for select using (auth.uid() = renter_id);
create policy "Owners see bookings on their items" on public.bookings for select
  using (exists (select 1 from public.items where id = item_id and owner_id = auth.uid()));
create policy "Renters can insert bookings" on public.bookings for insert with check (auth.uid() = renter_id);
create policy "Owner/renter can update booking" on public.bookings for update
  using (auth.uid() = renter_id or exists (select 1 from public.items where id = item_id and owner_id = auth.uid()));

-- Payments policies
create policy "Users see own payments" on public.payments for select
  using (exists (select 1 from public.bookings where id = booking_id and renter_id = auth.uid()));

-- Reviews policies
create policy "Reviews are public" on public.reviews for select using (true);
create policy "Completed bookings can be reviewed" on public.reviews for insert
  with check (
    auth.uid() = from_user_id and
    exists (select 1 from public.bookings where id = booking_id and status = 'completed')
  );

-- Indexes
create index if not exists idx_items_owner on public.items(owner_id);
create index if not exists idx_items_category on public.items(category);
create index if not exists idx_items_available on public.items(available);
create index if not exists idx_bookings_item on public.bookings(item_id);
create index if not exists idx_bookings_renter on public.bookings(renter_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_dates on public.bookings(start_date, end_date);
create index if not exists idx_reviews_item on public.reviews(item_id);
create index if not exists idx_reviews_to_user on public.reviews(to_user_id);
