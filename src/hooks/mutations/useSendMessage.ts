// src/hooks/mutations/useSendMessage.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabase';
import i18n from '../../i18n-next';
import { notifyMessageSent } from '../../lib/push';
import { UserFacingError } from '../../lib/errorText';

interface SendMessageParams {
  bookingId: string;
  senderId: string;
  body: string;
}

// Вставка идёт напрямую в таблицу, а не через edge-функцию, и это осознанно:
// единственное побочное действие сообщения — уведомление собеседника — не
// условие записи, а её следствие, и отказ уведомления сообщение не отменяет.
// Право писать проверяет политика "Participants send booking messages" —
// sender_id обязан совпасть с auth.uid(), а автор обязан быть стороной брони.
// Подделать чужое авторство нельзя даже при правке запроса в консоли.
const sendMessage = async ({ bookingId, senderId, body }: SendMessageParams): Promise<void> => {
  const trimmed = body.trim();
  if (!trimmed) throw new UserFacingError(i18n.t('booking.messageEmpty'));

  const { data, error } = await supabase
    .from('booking_messages')
    .insert([{ booking_id: bookingId, sender_id: senderId, body: trimmed }])
    .select('id')
    .single();

  if (error) throw error;

  // Собеседнику — уведомление. Единственное побочное действие сообщения,
  // и серверного события у вставки нет: поэтому зовёт клиент. Не ждём и
  // не падаем — сообщение уже записано (см. notifyMessageSent).
  if (data?.id) notifyMessageSent(data.id);
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.messages(variables.bookingId) });
    },
  });
};
