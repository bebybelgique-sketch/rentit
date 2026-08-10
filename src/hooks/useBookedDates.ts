// src/hooks/useBookedDates.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Тип для забронированного периода
interface BookedRange {
  start_date: string;
  end_date: string;
}

const fetchBookedDates = async (itemId: string | undefined): Promise<BookedRange[]> => {
  if (!itemId) return [];

  // Предполагаем, что RPC 'get_booked_dates' возвращает массив {start_date, end_date}
  // Если это не так, нужно адаптировать запрос.
  // Псевдокод: SELECT start_date, end_date FROM bookings WHERE item_id = itemId AND status = 'confirmed';
  const { data, error } = await supabase
    .rpc('get_booked_dates', { p_item_id: itemId });

  if (error) throw error;
  // Результат RPC может отличаться, предположим, он возвращает массив нужной структуры
  return data || [];
};

export const useBookedDates = (itemId: string | undefined) => {
  return useQuery<BookedRange[], Error>({
    queryKey: ['bookedDates', itemId],
    queryFn: () => fetchBookedDates(itemId),
    enabled: !!itemId, // Запрос выполняется только если itemId существует
    staleTime: 60000, // Данные считаются актуальными 1 минуту
  });
};