// src/hooks/mutations/useUpdateItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types';

// Колонки таблицы `items`, которые форма вправе менять. Список явный и
// закрытый — намеренно.
//
// Прежде здесь стояло `Partial<Omit<Item, …>> & Record<string, unknown>`, и
// это пропускало что угодно. `Item` — тип ПРИЛОЖЕНИЯ: в нём есть `image_url`
// и `location`, а колонок с такими именами в базе нет. Форма редактирования
// слала `image_url`, PostgREST отклонял ЗАПРОС ЦЕЛИКОМ (PGRST204,
// «Could not find the 'image_url' column»), и страница не сохраняла ничего —
// ни цену, ни описание. Компилятор при `Record<string, unknown>` молчал.
//
// Сверено с `information_schema.columns` живой базы 13.08.2026.
export type ItemUpdate = Partial<{
  title: string;
  description: string | null;
  category: string;
  condition: string;
  price_per_day: number;
  deposit: number;
  photos: string[];
  lat: number | null;
  lng: number | null;
  address: string | null;
  available: boolean;
}>;

interface UpdateItemParams {
  id: string;
  updates: ItemUpdate;
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