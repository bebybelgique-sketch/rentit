-- =============================================
-- RentIt: поиск по близости считает база, а не браузер
--
-- Было: витрина забирала ВСЕ подходящие вещи и отсеивала их по радиусу
-- гаверсинусом в браузере. На сегодняшней витрине это незаметно, но чинить
-- надо до наплыва, а не после: площадка не может ждать объявлений, чтобы
-- начать работать, а переписывать фильтр под нагрузкой — худший момент.
--
-- Выбран PostGIS 3.3.7 (доступен в проекте), а не earthdistance:
--   — earthdistance — надстройка над cube из 2000-х, умеет только точки и
--     сферу; PostGIS считает на сфероиде и переживёт следующий шаг
--     (границы коммун, прямоугольник видимой области карты);
--   — ST_DWithin по GiST-индексу отбирает кандидатов индексом, а не
--     перебором таблицы; earth_box требует ручной пары «box + точная
--     проверка», и эту пару легко рассинхронизировать.
-- Промежуточный вариант «bounding box руками на btree» отвергнут: он и есть
-- тот половинчатый инструмент, который через полгода переписывают.
--
-- Столбец location — GENERATED ALWAYS ... STORED, а не триггер: значение не
-- может разойтись с lat/lng ни при какой правке, и поддерживать нечего.
-- =============================================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Точка строится только когда есть обе координаты. Вещи без координат
-- остаются с NULL и в поиск по близости не попадают — это то же поведение,
-- что и раньше, но теперь о нём предупреждает форма выкладки.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS location extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN lat IS NOT NULL AND lng IS NOT NULL
      THEN extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
    END
  ) STORED;

-- Порядок аргументов ST_MakePoint — (долгота, широта). Перепутать их легко,
-- и ошибка тихая: точка уезжает в другое полушарие, но запрос отрабатывает.
-- Проверка ниже в комментарии к функции ловит это на живых данных.

CREATE INDEX IF NOT EXISTS idx_items_location
  ON public.items USING GIST (location);

-- =============================================
-- Витрина одним запросом: радиус, категория, цена, текст, место и занятость
-- на выбранные даты — всё на стороне базы.
--
-- Почему не «RPC отдаёт id, а клиент подставляет их в .in(...)»: список
-- уходит в строку адреса, и на паре сотен вещей в радиусе запрос упирается
-- в длину URL. Такой фильтр работает ровно до первого успеха площадки.
--
-- SECURITY INVOKER: политики на items продолжают действовать, функция ничего
-- не расширяет. Занятость берётся у items_busy_between — она SECURITY DEFINER
-- по своей причине (посторонний не видит чужих броней), и списки статусов
-- обязаны оставаться в одном месте, а не дублироваться здесь.
-- =============================================

CREATE OR REPLACE FUNCTION public.browse_items(
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL,
  p_radius_km  double precision DEFAULT NULL,
  p_category   text             DEFAULT NULL,
  p_search     text             DEFAULT NULL,
  p_max_price  numeric          DEFAULT NULL,
  p_place      text             DEFAULT NULL,
  p_start      date             DEFAULT NULL,
  p_end        date             DEFAULT NULL,
  p_limit      integer          DEFAULT 200
)
RETURNS TABLE (
  id              uuid,
  title           text,
  category        text,
  price_per_day   numeric,
  deposit         numeric,
  photos          jsonb,
  lat             double precision,
  lng             double precision,
  address         text,
  condition       public.item_condition,
  owner_id        uuid,
  owner_full_name text,
  owner_rating    numeric,
  owner_is_pro    boolean,
  distance_m      double precision
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions
AS $$
  WITH origin AS (
    SELECT CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
       AND p_lat BETWEEN  -90 AND  90
       AND p_lng BETWEEN -180 AND 180
      THEN extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
    END AS g
  )
  SELECT
    i.id, i.title, i.category, i.price_per_day, i.deposit, i.photos,
    i.lat, i.lng, i.address, i.condition, i.owner_id,
    -- Владелец нужен карточке (имя и рейтинг). Столбцы взяты из того же
    -- списка, что разрешён роли на чтение миграцией 07; SECURITY INVOKER
    -- означает, что права проверяются по вызывающему, а не в обход.
    u.full_name, u.rating_as_owner, u.is_pro,
    CASE WHEN o.g IS NOT NULL AND i.location IS NOT NULL
         THEN extensions.ST_Distance(i.location, o.g) END AS distance_m
  FROM public.items i
  CROSS JOIN origin o
  LEFT JOIN public.users u ON u.id = i.owner_id
  WHERE i.available = true
    AND (p_category  IS NULL OR i.category = p_category)
    AND (p_search    IS NULL OR i.title   ILIKE '%' || p_search || '%')
    AND (p_place     IS NULL OR i.address ILIKE '%' || p_place  || '%')
    AND (p_max_price IS NULL OR i.price_per_day <= p_max_price)
    -- Радиус применяется, только когда заданы и точка, и радиус. Верхняя
    -- граница 200 км не даёт вытянуть всю таблицу одним «радиусом» в 40000.
    AND (
      o.g IS NULL OR p_radius_km IS NULL
      OR (
        i.location IS NOT NULL
        AND extensions.ST_DWithin(i.location, o.g, LEAST(p_radius_km, 200) * 1000)
      )
    )
    AND (
      p_start IS NULL OR p_end IS NULL OR p_end < p_start
      OR i.id NOT IN (SELECT b.item_id FROM public.items_busy_between(p_start, p_end) b)
    )
  ORDER BY
    CASE WHEN o.g IS NOT NULL AND i.location IS NOT NULL
         THEN extensions.ST_Distance(i.location, o.g) END ASC NULLS LAST,
    i.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
$$;

GRANT EXECUTE ON FUNCTION public.browse_items(
  double precision, double precision, double precision,
  text, text, numeric, text, date, date, integer
) TO anon, authenticated;

-- Проверка после применения — на живых данных, а не на вере:
--
--   -- 1. Столбец заполнен там, где есть координаты, и пуст там, где нет:
--   SELECT count(*) FILTER (WHERE location IS NOT NULL) AS with_point,
--          count(*) FILTER (WHERE lat IS NOT NULL AND location IS NULL) AS broken
--     FROM public.items;   -- broken обязан быть 0
--
--   -- 2. Долгота и широта не перепутаны: расстояние от Вавра до вещи в
--   --    Брабанте должно быть десятками километров, а не тысячами.
--   SELECT title, round((distance_m/1000)::numeric, 1) AS km
--     FROM public.browse_items(50.7167, 4.6167, 50);
--
--   -- 3. Индекс действительно используется:
--   EXPLAIN ANALYZE SELECT * FROM public.browse_items(50.7167, 4.6167, 10);
