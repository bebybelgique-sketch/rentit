-- =============================================
-- 50. Точка вещи — примерная, до ~500 м
-- =============================================
--
-- ДЫРА (аудит 01.10, все три внешних ревью). Владелец ставит вещь кнопкой
-- «Utiliser ma position» — GPS телефона, то есть его дом с точностью до
-- метров. items.lat/lng открыты на чтение всем, включая аноним (политика
-- «Items are public», grant 27), и browse_items отдаёт их без входа.
-- Готовая карта: имя, фото, точка дома и список дорогих инструментов.
-- В users те же координаты закрыли ещё миграцией 14 как «домашние» — у
-- вещи они остались открытыми.
--
-- ПРАВИЛО. База хранит только примерную точку: координаты округляются к
-- сетке 0,005° (около 550 м по широте и 350 м по долготе в Бельгии) при
-- КАЖДОЙ записи — из формы, из API, из чего угодно. Точной точки в базе
-- нет, значит, её нельзя и раздать. Скрывать маркер в интерфейсе, оставляя
-- точку в ответе API, ничего бы не защитило.
--
-- Точное место встречи стороны и так договаривают в переписке брони после
-- одобрения — это и есть путь продукта («Convenez du lieu et de l'heure»).
--
-- Поиск «рядом» и сортировка по расстоянию остаются: location считается из
-- lat/lng (GENERATED, миграция 16), просто с точностью до квартала.
--
-- Вещей на проде 01.10 — ноль; UPDATE ниже на всякий случай приводит к
-- сетке то, что есть.
-- =============================================

CREATE OR REPLACE FUNCTION public.round_item_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lat IS NOT NULL THEN
    NEW.lat := round(NEW.lat::numeric * 200) / 200;
  END IF;
  IF NEW.lng IS NOT NULL THEN
    NEW.lng := round(NEW.lng::numeric * 200) / 200;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.round_item_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS items_round_location ON public.items;
CREATE TRIGGER items_round_location
  BEFORE INSERT OR UPDATE OF lat, lng ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.round_item_location();

UPDATE public.items SET lat = lat, lng = lng WHERE lat IS NOT NULL OR lng IS NOT NULL;
