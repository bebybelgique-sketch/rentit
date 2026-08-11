// src/hooks/useUserReviews.ts
import { useQuery } from '@tanstack/react-query';
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

  return (data || []).map((row) => {
    const author = row.users as unknown as { full_name: string | null; avatar_url: string | null } | null;
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
    queryKey: ['userReviews', userId, role],
    queryFn: () => fetchUserReviews(userId, role),
    enabled: !!userId,
    staleTime: 60000,
  });
};
