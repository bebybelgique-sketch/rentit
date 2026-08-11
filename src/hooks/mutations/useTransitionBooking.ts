// src/hooks/mutations/useTransitionBooking.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

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
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    status?: string;
    error?: string;
  }>('transition-booking', {
    body: { booking_id: bookingId, action, reason: reason ?? null },
  });

  if (error) throw new Error(data?.error || error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.status) throw new Error('Réponse inattendue du serveur');

  return data.status;
};

export const useTransitionBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transitionBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentalsAsOwner'] });
      queryClient.invalidateQueries({ queryKey: ['bookedDates'] });
    },
  });
};
