// src/hooks/mutations/useApproveRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

// Прямой update статуса из браузера технически прошёл бы (политика на update
// есть), но обошёл бы edge-функцию respond-to-request, где живут: проверка,
// что отвечает именно владелец вещи, повторная проверка занятости дат,
// создание платёжного намерения Stripe, запись в payments, авто-отклонение
// пересекающихся заявок и письма обеим сторонам. Поэтому — только функция.
interface ApproveRentalParams {
  bookingId: string;
}

const approveRental = async ({ bookingId }: ApproveRentalParams): Promise<void> => {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'respond-to-request',
    { body: { booking_id: bookingId, action: 'approve' } }
  );

  if (error) throw new Error(data?.error || error.message);
  if (data?.error) throw new Error(data.error);
};

export const useApproveRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveRental,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentalsAsOwner'] });
      queryClient.invalidateQueries({ queryKey: ['bookedDates'] });
    },
  });
};
