// src/hooks/useRentalsAsOwner.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Rental } from '../types';

// Определяем функцию для получения данных
const fetchRentalsAsOwner = async (userId: string | undefined): Promise<Rental[]> => {
  if (!userId) return [];

  // Предполагаем, что в таблице rentals есть поле item_id, связанное с вещью, и у вещи есть owner_id
  // Запрос может быть сложнее, если связи между вещами и арендами не прямые
  // Псевдокод: SELECT * FROM rentals WHERE item_id IN (SELECT id FROM items WHERE owner_id = userId)
  const { data, error } = await supabase
    .from('rentals')
    .select('*, items!inner(owner_id)') // Используем inner join, чтобы отфильтровать по владельцу вещи
    .eq('items.owner_id', userId);

  if (error) throw error;
  return data || [];
};

// Экспортируем хук, используя useQuery
export const useRentalsAsOwner = (userId: string | undefined) => {
  return useQuery<Rental[], Error>({
    queryKey: ['rentalsAsOwner', userId],
    queryFn: () => fetchRentalsAsOwner(userId),
    enabled: !!userId, // Запрос выполняется только если userId существует
    staleTime: 60000, // Данные считаются актуальными 1 минуту
  });
};