// src/hooks/useUserReviews.ts
import { useQuery } from '@tanstack/react-query';
import { reviewKeys } from '../lib/queryKeys';
import { supabase } from '../lib/supabase';

export type UserReviewRole = 'owner' | 'renter';

export interface UserReview {
  id: string;
  booking_id: string;
  from_user_id: string;
  to_user_id: string;
  review_type: UserReviewRole;
  rating: number;
  comment: string | null;
  created_at: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

// Отзывы о человеке, а не о вещи. Тип 'item' сюда не попадает намеренно:
// оценка вещи живёт на странице вещи и в репутацию человека не входит.
const fetchUserReviews = async (
  userId: string | undefined,
  role: UserReviewRole,
): Promise<UserReview[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('id, booking_id, from_user_id, to_user_id, review_type, rating, comment, created_at, users!from_user_id(full_name, avatar_url)')
    .eq('to_user_id', userId)
    .eq('review_type', role)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Двойного приведения здесь больше нет — почему, подробно в
  // useBookingMessages.ts. Коротко: `as unknown as` отключает проверку
  // целиком, а форма вложенной записи — ровно то, что проверять и надо.
  //
  // `?.` — против RLS (политика на users может скрыть автора), `||` для имени
  // — против пустой строки, `?? null` для аватара — потому что avatar_url
  // нулевой по схеме, и отсутствие снимка это не ошибка.
  return (data || []).map((row) => {
    const author = row.users;
    return {
      id: row.id,
      booking_id: row.booking_id,
      from_user_id: row.from_user_id,
      to_user_id: row.to_user_id,
      review_type: row.review_type as UserReviewRole,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
      authorName: author?.full_name || 'Utilisateur',
      authorAvatarUrl: author?.avatar_url ?? null,
    };
  });
};

export const useUserReviews = (userId: string | undefined, role: UserReviewRole) => {
  return useQuery<UserReview[], Error>({
    queryKey: reviewKeys.list(userId, role),
    queryFn: () => fetchUserReviews(userId, role),
    enabled: !!userId,
    staleTime: 60000,
  });
};
