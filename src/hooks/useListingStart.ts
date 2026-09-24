// src/hooks/useListingStart.ts
import { useQuery } from '@tanstack/react-query';
import { itemKeys } from '../lib/queryKeys';
import { supabase } from '../lib/supabase';

/**
 * Что форме выкладки нужно знать ДО первого показа.
 *
 * Оба вопроса — про то, чтобы не спрашивать человека лишний раз:
 *
 *   • просить ли фото профиля. У кого фото есть, тому просьба не нужна;
 *   • где стоял его прошлый инструмент. Замер 23.09 в роли нового соседа с
 *     телефона: пять инструментов подряд — и пять раз «Utiliser ma
 *     position», хотя всё лежит в одном сарае. Форма каждый раз начинала с
 *     нуля, а без позиции вещь не попадает в поиск «À proximité».
 *
 * Ответ нужен до показа формы, а не после. Форму, которую через долю
 * секунды сменяет просьба о фото, замерили там же: форма на 177 мс,
 * просьба на 391 мс — экран уходит из-под пальцев. Кнопка позиции,
 * меняющая надпись на глазах, была бы тем же самым.
 *
 * Отказ любого из запросов — не повод держать человека перед пустым
 * экраном: обе подсказки необязательны, форма важнее. Поэтому запрос не
 * бросает, и react-query не уходит в повторы с ожиданием.
 */
export type ListingStart = {
  needsPhoto: boolean;
  lastPlace: { lat: number; lng: number; address: string | null } | null;
};

/** Ничего не знаем — форма с чистого листа и без просьбы о фото. */
export const NO_START: ListingStart = { needsPhoto: false, lastPlace: null };

export async function fetchListingStart(userId: string): Promise<ListingStart> {
  const [profile, last] = await Promise.all([
    supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle(),
    // Последнее объявление С ПОЗИЦИЕЙ, а не просто последнее: вещь,
    // выложенная без позиции, не должна стирать место, известное по
    // предыдущим.
    supabase
      .from('items')
      .select('lat, lng, address')
      .eq('owner_id', userId)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const place = last.error ? null : last.data;
  return {
    needsPhoto: !profile.error && !profile.data?.avatar_url,
    lastPlace: place && place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng, address: place.address }
      : null,
  };
}

export function useListingStart(userId: string | undefined) {
  return useQuery({
    queryKey: itemKeys.listingStart(userId),
    enabled: !!userId,
    queryFn: () => fetchListingStart(userId!),
    // Каждый заход в форму — свежий ответ. Прошлое объявление могло
    // появиться минуту назад, и кэш с «позиции нет» вернул бы кнопку.
    staleTime: 0,
    gcTime: 0,
  });
}
