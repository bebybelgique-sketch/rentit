-- =============================================
-- RentIt: какие вещи заняты в выбранные даты
--
-- Без этого витрина показывает инструмент, который на нужные даты уже
-- отдан: человек пишет владельцу, ждёт и получает отказ. Для площадки,
-- у которой ещё не было ни одной сделки, это самая дорогая осечка —
-- первое же обращение заканчивается ничем.
--
-- Почему функция, а не фильтр в клиенте: политики на bookings пускают
-- к брони только её стороны ("Renters see own bookings", "Owners see
-- bookings on their items"). Посторонний, выбирающий даты, не видит
-- чужих броней и отфильтровать ничего не может.
--
-- SECURITY DEFINER выдаёт наружу ровно один факт — «эта вещь занята», —
-- который и так публичен через get_booked_dates на странице вещи. Ни
-- кто арендует, ни на какую сумму, ни с какой историей не раскрывается.
-- =============================================

CREATE OR REPLACE FUNCTION public.items_busy_between(p_start date, p_end date)
RETURNS TABLE (item_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT b.item_id
  FROM public.bookings b
  WHERE p_start IS NOT NULL
    AND p_end   IS NOT NULL
    AND p_end  >= p_start
    -- Только состояния, которые действительно держат вещь. Заявка
    -- (pending_approval) не блокирует: на одни даты их может быть
    -- несколько, и владелец выбирает. Так же считает и триггер
    -- check_item_availability — списки обязаны совпадать, иначе
    -- витрина и бронирование разойдутся в разные стороны.
    AND b.status IN ('pending_payment', 'confirmed', 'active')
    AND daterange(b.start_date, b.end_date, '[]')
        && daterange(p_start, p_end, '[]');
$$;

GRANT EXECUTE ON FUNCTION public.items_busy_between(date, date) TO anon, authenticated;
