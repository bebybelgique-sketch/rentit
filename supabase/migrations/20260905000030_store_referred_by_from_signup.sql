-- Store referral source in the profile row during signup without a client-side UPDATE.
-- This keeps public.users.referred_by writable only via the auth trigger, not via
-- the authenticated client role.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  referrer_id uuid;
begin
  referrer_id := null;

  if jsonb_typeof(new.raw_user_meta_data) = 'object' and jsonb_exists(new.raw_user_meta_data, 'referred_by') then
    begin
      referrer_id := (new.raw_user_meta_data->>'referred_by')::uuid;
    exception when invalid_text_representation then
      referrer_id := null;
    end;
  end if;

  insert into public.users (id, full_name, avatar_url, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    referrer_id
  );

  return new;
end;
$$;
