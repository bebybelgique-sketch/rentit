-- =============================================
-- RentIt: Availability & conflict prevention
-- =============================================

-- Prevent overlapping bookings for the same item
create or replace function public.check_item_availability()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.bookings
    where item_id = new.item_id
      and id != new.id
      and status not in ('cancelled', 'pending_payment')
      and daterange(start_date, end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'Item is not available for the selected dates';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_availability on public.bookings;
create trigger trg_check_availability
  before insert or update on public.bookings
  for each row execute function public.check_item_availability();

-- RPC: get booked date ranges for an item (for the calendar UI)
create or replace function public.get_booked_dates(p_item_id uuid)
returns table(start_date date, end_date date) language sql stable as $$
  select start_date, end_date
  from public.bookings
  where item_id = p_item_id
    and status not in ('cancelled', 'pending_payment')
$$;
