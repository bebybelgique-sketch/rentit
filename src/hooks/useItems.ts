// src/hooks/useItems.ts
import { useQuery } from '@tanstack/react-query'; // ИМПОРТ useQuery
import { supabase } from '../lib/supabase';
import { Item } from '../types';

// Определяем функцию для получения данных
const fetchItems = async (params?: { limit?: number; sortBy?: string; search?: string }): Promise<Item[]> => {
  let query = supabase.from('items').select('*');

  if (params?.search) {
    query = query.ilike('title', `%${params.search}%`);
  }

  if (params?.sortBy) {
    if (params.sortBy === 'created_at') {
      query = query.order('created_at', { ascending: false });
    }
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  const transformedItems: Item[] = data.map(rawItem => ({
    id: rawItem.id,
    title: rawItem.title,
    description: rawItem.description,
    price_per_day: rawItem.price_per_day,
    image_url: Array.isArray(rawItem.photos) && rawItem.photos.length > 0 ? rawItem.photos[0] : '',
    owner_id: rawItem.owner_id,
    location: rawItem.address,
    latitude: rawItem.lat,
    longitude: rawItem.lng,
    is_available: rawItem.available,
    created_at: rawItem.created_at,
  }));

  return transformedItems || [];
};

// Экспортируем хук, используя useQuery
export const useItems = (params?: { limit?: number; sortBy?: string; search?: string }) => {
  return useQuery<Item[], Error>({
    queryKey: ['items', params], // Уникальный ключ для кеширования
    queryFn: () => fetchItems(params),
    staleTime: 30000, // Данные считаются актуальными 30 секунд
  });
};