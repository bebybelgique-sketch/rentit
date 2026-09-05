import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { OwnerItem } from '../types';

// Вещи владельца вместе с бронями: один запрос вместо «вещи» + «брони по
// каждой вещи». Связка приходит из базы, а тип строки — `OwnerItem` из
// src/types: это `Item` (то есть `Tables<'items'>`) плюс проекция брони,
// собранная ровно из тех колонок, которые перечислены в select ниже.
//
// Строка возвращается КАК ЕСТЬ. Здесь стоял маппер, который переписывал
// `photos` в `string[]` и подставлял `renter: null` вместо отсутствующего
// поля; с типами из схемы оба действия лишние — `photos` читает `photosOf`
// по месту показа (src/lib/items.ts), а `renter` и так приходит `| null`.
// Маппер в хуке — это второй тип на одну строку и та же болезнь, из-за
// которой форма редактирования однажды потеряла сохранённые поля (PR #19).
const fetchOwnerItems = async (userId: string | undefined): Promise<OwnerItem[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('items')
    .select('*, bookings(id, item_id, renter_id, status, start_date, end_date, total_price, total_days, request_message, created_at, renter:users!renter_id(id, full_name, avatar_url))')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const useOwnerItems = (userId: string | undefined) => {
  return useQuery<OwnerItem[], Error>({
    queryKey: ['bookings', userId],
    queryFn: () => fetchOwnerItems(userId),
    enabled: !!userId,
    staleTime: 30000,
  });
};
