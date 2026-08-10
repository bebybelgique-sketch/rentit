// src/hooks/mutations/useCreateItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types';

interface CreateItemParams {
  title: string;
  description: string;
  price_per_day: number;
  deposit: number;
  category: string;
  condition: string;
  address: string;
  lat: number | null;
  lng: number | null;
  available: boolean;
  imageUrl: string; // Принимаем уже загруженный URL
  userId: string; // Владелец товара
}

const createItem = async (params: CreateItemParams): Promise<Item> => {
  const { imageUrl, userId, ...itemData } = params;

  // 2. Создать запись в таблице items
  const { data, error } = await supabase
    .from('items')
    .insert([{
      ...itemData,
      owner_id: userId,
      photos: imageUrl ? [imageUrl] : [], // Сохраняем URL как массив
    }])
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Item creation failed");

  // 3. Преобразовать и вернуть результат
  const mappedItem: Item = {
    id: data.id,
    title: data.title,
    description: data.description,
    price_per_day: data.price_per_day,
    image_url: imageUrl,
    owner_id: data.owner_id,
    location: data.address,
    latitude: data.lat,
    longitude: data.lng,
    is_available: data.available,
    created_at: data.created_at,
  };

  return mappedItem;
};

export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItem,
    onSuccess: (newItem) => {
      // Инвалидируем кэш для списка вещей
      queryClient.invalidateQueries({ queryKey: ['items'] });
      // Добавляем новый элемент в кэш
      queryClient.setQueryData(['item', newItem.id], newItem);
    },
  });
};