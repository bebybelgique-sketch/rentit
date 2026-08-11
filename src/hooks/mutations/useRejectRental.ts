// src/hooks/mutations/useRejectRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

// Как и одобрение — через respond-to-request: она проверяет, что отвечает
// владелец, что заявка ещё в статусе pending_approval, ставит 'rejected' и
// шлёт письмо арендатору. Поля «причина отказа» функция не принимает —
// добавлять его нужно сначала на сервере, а не в клиенте.
interface RejectRentalParams {
  bookingId: string;
}

const rejectRental = async ({ bookingId }: RejectRentalParams): Promise<void> => {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'respond-to-request',
    { body: { booking_id: bookingId, action: 'reject' } }
  );

  if (error) throw new Error(data?.error || error.message);
  if (data?.error) throw new Error(data.error);
};

export const useRejectRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectRental,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentalsAsOwner'] });
      queryClient.invalidateQueries({ queryKey: ['bookedDates'] });
    },
  });
};
