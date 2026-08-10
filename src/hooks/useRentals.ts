// src/hooks/useRentals.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Rental } from '../types';

// Определяем функцию для получения данных
const fetchRentals = async (userId: string | undefined): Promise<Rental[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('rentals')
    .select('*, items(*)')
    .eq('renter_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
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