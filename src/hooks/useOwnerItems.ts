import { useQuery } from '@tanstack/react-query';
import { photosOf } from '../lib/items';
import { supabase } from '../lib/supabase';
import type { Item, Rental } from '../types';

export type OwnerItem = Item & {
  bookings: Array<
    Rental & {
      renter?: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      } | null;
    }
  >;
};

const fetchOwnerItems = async (userId: string | undefined): Promise<OwnerItem[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('items')
    .select('*, bookings(id, item_id, renter_id, status, start_date, end_date, total_price, total_days, request_message, created_at, renter:users!renter_id(id, full_name, avatar_url))')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(item => ({
    ...item,
    photos: photosOf(item),
    bookings: (item.bookings ?? []).map(booking => ({
      ...booking,
      renter: booking.renter ?? null,
    })),
  }));
};

export const useOwnerItems = (userId: string | undefined) => {
  return useQuery<OwnerItem[], Error>({
    queryKey: ['bookings', userId],
    queryFn: () => fetchOwnerItems(userId),
    enabled: !!userId,
    staleTime: 30000,
  });
};
