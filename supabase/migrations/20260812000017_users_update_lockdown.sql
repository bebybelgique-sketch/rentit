-- =============================================
-- RentIt: закрыть подтверждение телефона без телефона
--
-- Миграция 08 объявила эту дыру закрытой («CRITICAL phone_otp bypass via
-- direct UPDATE») и НЕ закрыла её. Замер 12.08:
--
--   information_schema.column_privileges → authenticated имеет UPDATE
--   на ВСЕХ 22 столбцах public.users, включая phone_otp,
--   phone_otp_expires_at и stripe_customer_id.
--
-- Почему REVOKE из миграции 08 не подействовал: у роли есть ТАБЛИЧНЫЙ грант
-- на UPDATE, а колоночный REVOKE не вырезает из него дырку — Postgres
-- оставляет табличное право действующим. Снять можно только табличное право
-- целиком и выдать заново поимённо.
--
-- Чем это грозит. Политика "Users can update own safe fields" пришпиливает
-- role, phone_verified, is_pro, business_plan, referred_by и рейтинги — но
-- НЕ phone_otp. А функция verify-phone сверяет присланный код именно с
-- users.phone_otp и по совпадению ставит phone_verified = true:
--
--   1. UPDATE users SET phone_otp='123456',
--        phone_otp_expires_at='2030-01-01' WHERE id = auth.uid();
--   2. вызвать verify-phone с '123456';
--   3. phone_verified = true — телефоном при этом никто не владеет.
--
-- Значок «телефон подтверждён» — это обещание доверия второй стороне сделки
-- между незнакомыми людьми. Обещание, которое можно поставить себе самому,
-- хуже отсутствующего.
--
-- Совместимость проверена по коду, а не предположена:
--   • verify-phone работает служебным ключом (createSupabaseServiceClient) —
--     грантов клиента не касается, отправка и проверка кода не ломаются;
--   • сохранение профиля пишет full_name и avatar_url — оба в списке ниже;
--   • Register пишет referred_by, а Admin — role: оба уже отвергались
--     политикой, поведение не меняется (см. заметку в конце файла).
-- =============================================

REVOKE UPDATE ON public.users FROM anon, authenticated;

-- Ровно то, что человек меняет о себе сам. Всё остальное — служебное:
-- либо пишется функцией со служебным ключом, либо пришпилено политикой.
GRANT UPDATE (
  full_name,
  avatar_url,
  phone,
  village,
  lat,
  lng
) ON public.users TO authenticated;

-- anon в список не входит намеренно: у неаутентифицированного посетителя нет
-- своей строки, и auth.uid() = id для него никогда не истинно.

-- Проверка после применения (ожидается ровно шесть строк, среди них НЕТ
-- phone_otp, phone_otp_expires_at и stripe_customer_id):
--
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_name='users' AND grantee='authenticated'
--      AND privilege_type='UPDATE' ORDER BY column_name;
--
-- Поведением: войти, сохранить профиль (имя и аватар) — проходит;
-- попытка UPDATE users SET phone_otp=… от роли authenticated — отказ.

-- ЗАМЕТКА, не закрытая этой миграцией: смена роли в /admin
-- (src/pages/Admin.tsx) идёт клиентским UPDATE role, а политика пришпиливает
-- role к текущему значению — то есть кнопка выдачи прав администратора не
-- работает и до этой миграции. Здесь ничего не ухудшается; чинить нужно
-- отдельно и служебной функцией, а не расширением прав клиента.
