-- Add insurance_amount to bookings and payments
alter table public.bookings add column if not exists insurance_amount numeric(10,2) not null default 0;
alter table public.payments add column if not exists insurance_amount int not null default 0;
