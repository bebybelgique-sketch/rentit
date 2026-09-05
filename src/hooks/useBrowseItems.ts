// src/hooks/useBrowseItems.ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { itemKeys } from '../lib/queryKeys';
import { supabase } from '../lib/supabase';
import type { BrowseArgs, BrowseRow } from '../types';

/**
 * Фильтры витрины — ровно то, что человек настроил на странице.
 *
 * `type`, а не `interface`: ключ запроса принимает `Record<string, unknown>`,
 * а интерфейс без индексной сигнатуры в него не кладётся.
 */
export type BrowseFilters = {
  /** Текст поиска; пустая строка означает «не фильтровать». */
  search?: string;
  /** Значение из справочника категорий; пустая строка — «все». */
  category?: string;
  /** Предельная цена за день. */
  maxPrice?: number;
  /** Место, вписанное человеком (не координаты). */
  place?: string;
  /** Начало и конец периода в YYYY-MM-DD. */
  startDate?: string;
  endDate?: string;
  /** Включён ли отбор по близости. */
  nearby?: boolean;
  /** Радиус в километрах — имеет смысл только при включённой близости. */
  radiusKm?: number;
  /** Точка посетителя, если браузер её отдал. */
  lat?: number | null;
  lng?: number | null;
};

// Всю выборку делает база одной функцией: радиус по GiST-индексу, категория,
// цена, текст, место и занятость на выбранные даты.
//
// Раньше браузер забирал все подходящие вещи и отсеивал их по радиусу сам. На
// пустой витрине разницы не видно, но чинить это надо до наплыва: под
// нагрузкой переписывать фильтр — худший момент.
//
// Точку передаём всегда, когда она известна, а радиус — только когда включена
// близость. Так расстояние приходит и для показа на карточке, а отбор по
// радиусу остаётся отдельным решением человека.
const toArgs = (filters: BrowseFilters): BrowseArgs => {
  const { search, category, maxPrice, place, startDate, endDate, nearby, radiusKm, lat, lng } = filters;
  const hasPoint = typeof lat === 'number' && typeof lng === 'number';
  // Диапазон имеет смысл только целиком и только в прямом порядке: половина
  // диапазона отправила бы в функцию условие, которого человек не задавал.
  const rangeOrdered = !!startDate && !!endDate && endDate >= startDate;

  return {
    p_category: category?.trim() || undefined,
    p_search: search?.trim() || undefined,
    // NaN уехал бы в базу и отфильтровал витрину в ноль: «ничего не нашлось»
    // вместо «поле заполнено мусором».
    p_max_price: typeof maxPrice === 'number' && Number.isFinite(maxPrice) ? maxPrice : undefined,
    p_place: place?.trim() || undefined,
    p_start: rangeOrdered ? startDate : undefined,
    p_end: rangeOrdered ? endDate : undefined,
    p_lat: hasPoint ? lat : undefined,
    p_lng: hasPoint ? lng : undefined,
    p_radius_km: nearby && hasPoint ? radiusKm : undefined,
  };
};

const fetchBrowseItems = async (filters: BrowseFilters): Promise<BrowseRow[]> => {
  const { data, error } = await supabase.rpc('browse_items', toArgs(filters));
  if (error) throw error;
  return data ?? [];
};

/**
 * Витрина.
 *
 * `placeholderData: keepPreviousData` (в react-query v5 опция
 * `keepPreviousData` удалена, вместо неё — placeholder) держит прежнюю
 * выдачу, пока идёт запрос с новым фильтром. Без неё каждое нажатие на чип
 * категории показывало шесть скелетов: список мигал пустотой там, где
 * человек просто уточнил запрос. Скелеты остаются на первую загрузку —
 * `isPending`, а не `isFetching`.
 */
export const useBrowseItems = (filters: BrowseFilters) => {
  return useQuery({
    // В ключ входят ВСЕ фильтры: ключ, не знающий о радиусе, отдал бы
    // вчерашнюю выдачу после его изменения.
    queryKey: itemKeys.browse(filters),
    queryFn: () => fetchBrowseItems(filters),
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });
};
