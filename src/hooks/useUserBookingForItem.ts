// src/hooks/useUserBookingForItem.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Тип для бронирования, если не определен в supabase.ts
interface Booking {
  id: string;
  item_id: string;
  renter_id: string;
  status: string; // e.g., 'completed'
  // другие поля
}

const fetchUserBookingForItem = async (itemId: string | undefined, userId: string | undefined): Promise<Booking | null> => {
  if (!itemId || !userId) return null;

  const { data, error } = await supabase
    .from('bookings')
    .select('id, item_id, renter_id, status')
    .eq('item_id', itemId)
    .eq('renter_id', userId)
    .eq('status', 'completed') // Только завершенные бронирования дают право на отзыв
    .maybeSingle(); // maybeSingle возвращает null, если запись не найдена

  if (error) throw error;
  return data; // data может быть объектом или null
};

export const useUserBookingForItem = (itemId: string | undefined) => {
  const { user } = useAuth();
  return useQuery<Booking | null, Error>({
    queryKey: ['userBookingForItem', itemId, user?.id],
    queryFn: () => fetchUserBookingForItem(itemId, user?.id),
    enabled: !!itemId && !!user?.id, // Запрос выполняется только если itemId и userId существуют
    staleTime: 300000, // Данные считаются актуальными 5 минут
  });
};