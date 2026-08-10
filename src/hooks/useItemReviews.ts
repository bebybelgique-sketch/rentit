// src/hooks/useItemReviews.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Тип для отзыва, если не определен в supabase.ts
interface Review {
  id: string;
  item_id: string;
  from_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  users: { // Предполагаем, что join с таблицей users возвращает объект users
    full_name: string;
    avatar_url: string | null;
  } | null;
}

const fetchItemReviews = async (itemId: string | undefined): Promise<Review[]> => {
  if (!itemId) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('*, users!from_user_id(full_name, avatar_url)') // Предполагаемый join
    .eq('item_id', itemId)
    .eq('review_type', 'item')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const useItemReviews = (itemId: string | undefined) => {
  return useQuery<Review[], Error>({
    queryKey: ['itemReviews', itemId],
    queryFn: () => fetchItemReviews(itemId),
    enabled: !!itemId, // Запрос выполняется только если itemId существует
    staleTime: 30000, // Данные считаются актуальными 30 секунд
  });
};