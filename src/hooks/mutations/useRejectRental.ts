// src/hooks/mutations/useRejectRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdge } from '../../lib/edgeInvoke';

// Как и одобрение — через respond-to-request: она проверяет, что отвечает
// владелец, что заявка ещё в статусе pending_approval, ставит 'rejected' и
// шлёт письмо арендатору. Поля «причина отказа» функция не принимает —
// добавлять его нужно сначала на сервере, а не в клиенте.
interface RejectRentalParams {
  bookingId: string;
}

// Как и одобрение: отказ приходит кодом, разбирает его invokeEdge.
const rejectRental = async ({ bookingId }: RejectRentalParams): Promise<void> => {
  await invokeEdge<{ ok?: boolean }>('respond-to-request', {
    booking_id: bookingId,
    action: 'reject',
  });
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
