// src/hooks/mutations/useUpdateItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types';

interface UpdateItemParams {
  id: string;
  // Поля, которые можно обновить, исключая id, owner_id и created_at.
  // Record<string, unknown> — потому что формы шлют имена КОЛОНОК базы
  // (address, lat, lng, available), а Item описан в терминах приложения
  // (location, latitude, longitude, is_available). Свести их — отдельная задача.
  updates: Partial<Omit<Item, 'id' | 'owner_id' | 'created_at'>> & Record<string, unknown>;
  userId: string; // Владелец товара
}

const updateItemById = async ({ id, updates, userId }: UpdateItemParams): Promise<Item> => {
  // Проверка авторизации (RLS в БД)
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .match({ id: id, owner_id: userId }) // match может быть не нужен, если RLS строго ограничивает
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Item not found or update failed");

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

export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateItemById,
    onSuccess: (updatedItem) => {
      // Инвалидируем кэш для списка вещей
      queryClient.invalidateQueries({ queryKey: ['items'] });
      // Обновляем конкретный элемент в кэше
      queryClient.setQueryData(['item', updatedItem.id], updatedItem);
    },
  });
};