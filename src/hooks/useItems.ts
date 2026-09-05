// src/hooks/useItems.ts
import { useQuery } from '@tanstack/react-query';
import { photosOf } from '../lib/items';
import { supabase } from '../lib/supabase';
import type { Item } from '../types';

const fetchItems = async (params?: { limit?: number; sortBy?: string; search?: string }): Promise<Item[]> => {
  let query = supabase.from('items').select('*');

  if (params?.search) {
    query = query.ilike('title', `%${params.search}%`);
  }

  if (params?.sortBy === 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(item => ({ ...item, photos: photosOf(item) }));
};

export const useItems = (params?: { limit?: number; sortBy?: string; search?: string }) => {
  return useQuery<Item[], Error>({
    queryKey: ['items', params],
    queryFn: () => fetchItems(params),
    staleTime: 30000,
  });
};