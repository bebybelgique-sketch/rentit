// src/hooks/mutations/useApproveRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateBookingCaches } from '../../lib/queryKeys';
import { invokeEdge } from '../../lib/edgeInvoke';

// Прямого update статуса из браузера не существует: политики UPDATE на
// bookings сняты миграцией 20260811000012. Но дело не только в правах — в
// respond-to-request живут проверка, что отвечает именно владелец вещи,
// повторная проверка занятости дат, авто-отклонение заявок, которые после
// одобрения стало невозможно исполнить, и письма обеим сторонам.
// (Stripe и запись в payments отсюда ушли вместе с платежами: расчёт
// наличными при передаче, одобрение сразу ставит confirmed.)
interface ApproveRentalParams {
  bookingId: string;
}

// Отказ приходит кодом ('dates_unavailable', 'booking_changed'), и
// разбирает его invokeEdge: тело не-2xx ответа supabase-js прячет в
// error.context, поэтому прежняя строчка `data?.error || error.message`
// всегда показывала человеку «Edge Function returned a non-2xx status
// code» вместо причины. Текст по коду подбирает страница.
const approveRental = async ({ bookingId }: ApproveRentalParams): Promise<void> => {
  await invokeEdge<{ ok?: boolean }>('respond-to-request', {
    booking_id: bookingId,
    action: 'approve',
  });
};

export const useApproveRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveRental,
    onSuccess: () => {
      // Оба списка броней и списки вещей: заявка видна владельцу в «Моих
      // вещах», а занятость дат — на витрине. Набор ключей один на все
      // мутации броней (src/lib/queryKeys.ts); мёртвый ключ занятых дат из
      // него удалён — такой запрос не объявлял никто.
      invalidateBookingCaches(queryClient);
    },
  });
};
