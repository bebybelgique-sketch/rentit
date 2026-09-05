// src/hooks/mutations/useRejectRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateBookingCaches } from '../../lib/queryKeys';
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
      // Оба списка броней и списки вещей: заявка видна владельцу в «Моих
      // вещах», а занятость дат — на витрине. Набор ключей один на все
      // мутации броней (src/lib/queryKeys.ts); мёртвый ключ занятых дат из
      // него удалён — такой запрос не объявлял никто.
      invalidateBookingCaches(queryClient);
    },
  });
};
