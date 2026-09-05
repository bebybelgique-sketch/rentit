// src/hooks/useRentals.ts
import { useQuery } from '@tanstack/react-query';
import { photosOf } from '../lib/items';
import { supabase } from '../lib/supabase';
import { Rental } from '../types';

// Определяем функцию для получения данных
const fetchRentals = async (userId: string | undefined): Promise<Rental[]> => {
  if (!userId) return [];

  // Владелец приходит вложенным в вещь: арендатору нужно имя человека, у
  // которого он забирает инструмент, и его репутация — иначе «встретиться с
  // незнакомцем» остаётся встречей с идентификатором.
  const { data, error } = await supabase
    .from('bookings')
    // Псевдоним item: без него PostgREST кладёт связь под именем таблицы
    // ("items"), а страница читает rental.item — и получала undefined,
    // показывая «N/A» вместо названия вещи при любом ответе.
    .select('*, item:items(*, owner:users!owner_id(id, full_name, avatar_url, rating_as_owner))')
    .eq('renter_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rental => ({
    ...rental,
    item: rental.item ? { ...rental.item, photos: photosOf(rental.item) } : null,
  }));
};

// Экспортируем хук, используя useQuery
export const useRentals = (userId: string | undefined) => {
  return useQuery<Rental[], Error>({
    queryKey: ['rentals', userId],
    queryFn: () => fetchRentals(userId),
    enabled: !!userId, // Запрос выполняется только если userId существует
    staleTime: 60000, // Данные считаются актуальными 1 минуту
  });
};