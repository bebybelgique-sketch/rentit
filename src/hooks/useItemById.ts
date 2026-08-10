// src/hooks/useItemById.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Item } from '../types';

// Определяем функцию для получения данных
const fetchItemById = async (id: string): Promise<Item | null> => {
  if (!id) return null;

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Код ошибки "Row not found"
      return null;
    }
    throw error;
  }

  // Преобразование данных из Supabase к типу Item
  const mappedItem: Item = {
    id: data.id,
    title: data.title,
    description: data.description,
    price_per_day: data.price_per_day,
    image_url: Array.isArray(data.photos) && data.photos.length > 0 ? data.photos[0] : '',
    owner_id: data.owner_id,
    location: data.address,
    latitude: data.lat,
    longitude: data.lng,
    is_available: data.available,
    created_at: data.created_at,
  };

  return mappedItem;
};

// Экспортируем хук, используя useQuery
export const useItemById = (id: string | undefined) => {
  return useQuery<Item | null, Error>({
    queryKey: ['item', id],
    queryFn: () => fetchItemById(id!),
    enabled: !!id, // Запрос выполняется только если id существует
    staleTime: 30000, // Данные считаются актуальными 30 секунд
  });
};