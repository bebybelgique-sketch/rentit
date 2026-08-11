// src/hooks/useBookingMessages.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface BookingMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  senderName: string;
}

// Кто увидит переписку, решает RLS ("Participants read booking messages"),
// а не этот запрос: посторонний получит пустой список, а не ошибку. Поэтому
// фильтра по участию здесь нет — дублировать правило в клиенте значит завести
// второй источник истины, который однажды разойдётся с первым.
const fetchBookingMessages = async (bookingId: string | undefined): Promise<BookingMessage[]> => {
  if (!bookingId) return [];

  const { data, error } = await supabase
    .from('booking_messages')
    .select('id, booking_id, sender_id, body, created_at, users!sender_id(full_name)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => {
    const sender = row.users as unknown as { full_name: string | null } | null;
    return {
      id: row.id,
      booking_id: row.booking_id,
      sender_id: row.sender_id,
      body: row.body,
      created_at: row.created_at,
      senderName: sender?.full_name || 'Utilisateur',
    };
  });
};

export const useBookingMessages = (bookingId: string | undefined) => {
  return useQuery<BookingMessage[], Error>({
    queryKey: ['bookingMessages', bookingId],
    queryFn: () => fetchBookingMessages(bookingId),
    enabled: !!bookingId,
    // Реального времени в этом выпуске нет: переписка нужна, чтобы
    // договориться о встрече, а не чтобы болтать. Полминуты достаточно.
    staleTime: 30000,
  });
};
