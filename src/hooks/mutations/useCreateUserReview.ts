// src/hooks/mutations/useCreateUserReview.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { UserReviewRole } from '../useUserReviews';

interface CreateUserReviewParams {
  bookingId: string;
  itemId: string;
  fromUserId: string;
  toUserId: string;
  reviewType: UserReviewRole;
  rating: number;
  comment?: string | null;
}

// Все инварианты отзыва живут в политике "Participants review the other side
// after completion": автор — сторона брони, адресат — вторая сторона, бронь
// завершена, тип соответствует стороне. Повтор отсекается уникальным ключом.
// Здесь проверяем только то, что бессмысленно гонять до сервера.
const createUserReview = async ({
  bookingId,
  itemId,
  fromUserId,
  toUserId,
  reviewType,
  rating,
  comment,
}: CreateUserReviewParams): Promise<void> => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('La note doit être comprise entre 1 et 5');
  }

  const { error } = await supabase.from('reviews').insert([{
    booking_id: bookingId,
    item_id: itemId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    review_type: reviewType,
    rating,
    comment: comment?.trim() || null,
  }]);

  // 23505 — уникальный ключ (booking_id, from_user_id, review_type).
  // Для человека это не «ошибка базы», а «вы уже оценили эту сделку».
  if (error) {
    if (error.code === '23505') throw new Error('Vous avez déjà laissé cet avis');
    throw error;
  }
};

export const useCreateUserReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUserReview,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userReviews', variables.toUserId] });
      // Рейтинг в users пересчитывает триггер recompute_user_rating,
      // поэтому профиль обязан перечитаться — иначе на экране останется
      // прежнее число, которого в базе уже нет.
      queryClient.invalidateQueries({ queryKey: ['profile', variables.toUserId] });
      queryClient.invalidateQueries({ queryKey: ['item', variables.itemId] });
    },
  });
};
