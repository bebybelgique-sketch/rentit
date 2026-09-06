// src/hooks/mutations/useTransitionBooking.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateBookingCaches } from '../../lib/queryKeys';
import { invokeEdge, EdgeError } from '../../lib/edgeInvoke';

export type BookingAction = 'cancel' | 'handover' | 'complete';

interface TransitionBookingParams {
  bookingId: string;
  action: BookingAction;
  reason?: string | null;
}

// Единственный путь смены статуса из интерфейса. Прямой update по таблице
// невозможен: миграция 20260811000012 сняла политики UPDATE и отозвала право
// у роли authenticated. Функция отвечает 409, если бронь успела измениться, —
// это не сбой, а честное «состояние уже другое», и показывать его надо как есть.
const transitionBooking = async ({
  bookingId,
  action,
  reason,
}: TransitionBookingParams): Promise<string> => {
  const data = await invokeEdge<{ ok?: boolean; status?: string }>('transition-booking', {
    booking_id: bookingId,
    action,
    reason: reason ?? null,
  });

  // Ответ 2xx без статуса — не «почти получилось»: мы не знаем, в каком
  // состоянии бронь, и рисовать по догадке нельзя.
  if (!data.status) throw new EdgeError('internal_error');

  return data.status;
};

export const useTransitionBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transitionBooking,
    onSuccess: () => {
      // Оба списка броней и списки вещей: заявка видна владельцу в «Моих
      // вещах», а занятость дат — на витрине. Набор ключей один на все
      // мутации броней (src/lib/queryKeys.ts); мёртвый ключ занятых дат из
      // него удалён — такой запрос не объявлял никто.
      invalidateBookingCaches(queryClient);
    },
  });
};
