// src/hooks/useRentalsAsOwner.ts
import { useQuery } from '@tanstack/react-query';
import { bookingKeys } from '../lib/queryKeys';
import { supabase } from '../lib/supabase';
import type { RentalWithRenter } from '../types';

// Профиль арендатора берётся здесь, а не догружается страницей по одному
// запросу на строку: до 11.08 его не брали вовсе, и владелец видел в списке
// сырой UUID вместо человека, с которым ему предстоит встретиться.
// Связь users!renter_id — это внешний ключ bookings_renter_id_fkey.
const fetchRentalsAsOwner = async (userId: string | undefined): Promise<RentalWithRenter[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('bookings')
    // Псевдоним item — по той же причине, что и в useRentals: страница
    // читает rental.item, а PostgREST без псевдонима отдаёт "items".
    .select('*, item:items!inner(*), renter:users!renter_id(id, full_name, avatar_url, rating_as_renter)')
    .eq('item.owner_id', userId);

  if (error) throw error;
  return data ?? [];
};

export const useRentalsAsOwner = (userId: string | undefined) => {
  return useQuery<RentalWithRenter[], Error>({
    queryKey: bookingKeys.asOwner(userId),
    queryFn: () => fetchRentalsAsOwner(userId),
    enabled: !!userId, // Запрос выполняется только если userId существует
    staleTime: 60000, // Данные считаются актуальными 1 минуту
  });
};
