-- Приглашение соседа: код и учёт приглашений — только на сервере.
--
-- ЧТО БЫЛО. Миграция 28 выдала анониму и authenticated чтение колонок
-- referral_code и referred_by, а политика «Public user names/ratings
-- visible» пускает к ЛЮБОЙ строке users (using (true)). Значит, кто угодно
-- с ключом из бандла читал коды приглашения всех людей и весь граф «кто
-- кого пригласил». Сверено на живой базе 24.09.2026:
--
--   select has_column_privilege('anon', 'public.users', 'referred_by', 'SELECT');
--   → true  (и то же для referral_code и для authenticated)
--
-- Граф был пуст (0 приглашённых из 4 учёток): свою ссылку человеку взять
-- было негде, работала только принимающая половина (Register.tsx читал
-- ?ref= и сам искал id по коду). Кнопка «Inviter un voisin» этот граф
-- наполнит — поэтому колонки закрываются ДО неё, а не после.
--
-- ЧТО СТАЛО.
--
--   1. Код ищет триггер регистрации (security definer): клиент кладёт в
--      метаданные signUp САМ КОД, а не id, найденный своим запросом.
--      Прежний путь — referred_by с uuid в метаданных — снят целиком: id
--      людей публичны (users.id читается всеми), и любой мог приписать
--      свою регистрацию кому угодно. Код после этой миграции знает только
--      его владелец и те, кому он отправил ссылку.
--   2. Свой код и число пришедших по нему человек получает функцией
--      my_invite(). Имён пришедших она не отдаёт: приглашённый не
--      соглашался, чтобы его показывали пригласившему.
--   3. Колонки referral_code и referred_by клиентским ролям не читаются.
--
-- ПЕРЕХОДНОЕ ОКНО. Уже развёрнутый клиент до выкладки нового ищет id по
-- коду сам — после этой миграции поиск получит отказ в праве. Register.tsx
-- на отказ не падает (пишет в консоль и регистрирует без приглашения), то
-- есть окно стоит максимум атрибуции, а не регистрации. Ссылок с кодом в
-- обращении сегодня нет — терять нечего.

revoke select (referral_code, referred_by) on public.users from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  referrer_id uuid;
begin
  referrer_id := null;

  if jsonb_typeof(new.raw_user_meta_data) = 'object' then
    code := upper(new.raw_user_meta_data->>'referral_code');
    -- Код — восемь шестнадцатеричных знаков (generate_referral_code из
    -- миграции 01). Иное — не код: опечатка или выдумка. Регистрируем без
    -- приглашения: потерянная строка учёта несопоставима с потерянной
    -- учёткой, а исключение здесь отменило бы создание auth.users целиком
    -- (триггер висит AFTER INSERT на нём).
    if code ~ '^[0-9A-F]{8}$' then
      select u.id into referrer_id from public.users u where u.referral_code = code;
    end if;
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

create or replace function public.my_invite()
returns table (code text, joined integer)
language sql
stable
security definer
set search_path = public
as $$
  select u.referral_code,
         (select count(*)::integer from public.users r where r.referred_by = u.id)
  from public.users u
  where u.id = auth.uid();
$$;

-- Умолчания Supabase выдают EXECUTE на новую функцию всем ролям. Анониму
-- она бесполезна (auth.uid() пуст), но и выдавать её незачем.
revoke all on function public.my_invite() from public, anon, authenticated;
grant execute on function public.my_invite() to authenticated;

-- Проверка на живой базе после применения:
--
--   select r, c, has_column_privilege(r, 'public.users', c, 'SELECT')
--   from unnest(array['anon','authenticated']) r,
--        unnest(array['referral_code','referred_by']) c;
--   → все четыре false
--
--   select has_function_privilege('anon', 'public.my_invite()', 'EXECUTE');
--   → false
