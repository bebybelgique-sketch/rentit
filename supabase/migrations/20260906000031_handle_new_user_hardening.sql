-- Миграция 31: закрепление search_path у триггера регистрации и отказ
-- хранить реферера, которого в базе нет.
--
-- Порядок выката — в описании PR: db push → functions deploy → test:edge →
-- смоук → merge. Миграции в этом проекте применяют руками, поэтому файл в
-- репозитории о состоянии живой базы ничего не говорит; перед применением
-- убедиться, что 20260905000028 и 20260905000030 уже на месте.

-- ── 1. search_path ────────────────────────────────────────────────────
-- В проекте 18 функций SECURITY DEFINER, и у 16 в подписи стоит
-- `SET search_path = public`. Два исключения — обе версии handle_new_user:
-- исходная (20260319000001_01_initial_schema.sql:26) и перезапись из
-- 20260905000030_store_referred_by_from_signup.sql:5. Атрибут здесь не
-- «снимали»: его не было с самого начала, и миграция 30 просто повторила
-- прежнее состояние, упустив повод выровнять функцию с принятым порядком.
--
-- Эксплуатируемой дыры это не создаёт: тело ссылается на public.users
-- полным именем, а встроенные функции и тип uuid разрешаются из pg_catalog,
-- который при незаданном search_path и так идёт первым. Но функция
-- исполняется как SECURITY DEFINER на триггере схемы auth, единственная её
-- защита от подмены разрешения имён — явно закреплённый путь, и линтер
-- Supabase (security_function_search_path) такие места помечает. «Два
-- исключения на 18» — это ровно тот шум, в котором теряется настоящее
-- замечание.

-- ── 2. Реферер обязан существовать ────────────────────────────────────
-- public.users.referred_by объявлен как `uuid references public.users(id)`
-- (20260319000001_01_initial_schema.sql:19, ключ users_referred_by_fkey,
-- ON DELETE не задан — значит NO ACTION).
--
-- Миграция 30 закрыла синтаксис: UUID неверного вида больше не роняет
-- приведение `::uuid`, а обнуляется в обработчике invalid_text_representation.
-- Незакрытым остался UUID ПРАВИЛЬНЫЙ, но отсутствующий в public.users: он
-- доезжает до INSERT, тот падает на внешнем ключе, а вместе с ним падает вся
-- регистрация — триггер висит AFTER INSERT на auth.users, исключение в нём
-- отменяет создание учётки целиком.
--
-- Откуда берётся такой UUID, если Register.tsx подставляет только id,
-- найденный по referral_code? Из того, что user_metadata — это ВХОД: signUp
-- принимает options.data дословно от любого клиента, поэтому прислать
-- произвольный UUID может не только наше приложение. Человек, который
-- правит ссылку ?ref=… руками или повторяет чужой signUp из консоли,
-- получает отказ вместо учётки, и отказ этот выглядит как поломка сервера.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

  -- Реферера нет в базе — регистрируем без него. Приглашение устарело или
  -- выдумано; потерянная строка статистики несопоставима с потерянной
  -- учёткой. Без этой проверки INSERT ниже нарушит users_referred_by_fkey.
  if referrer_id is not null and not exists (
    select 1 from public.users u where u.id = referrer_id
  ) then
    referrer_id := null;
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
