// src/hooks/mutations/useUpdateItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';
import type { Item } from '../../types';

// Колонки таблицы `items`, которые форма вправе менять. Список явный и
// закрытый — намеренно.
//
// Прежде здесь стояло `Partial<Omit<Item, …>> & Record<string, unknown>`, и
// это пропускало что угодно. `Item` был типом ПРИЛОЖЕНИЯ: в нём жило
// `image_url`, а колонки с таким именем в базе нет. Форма редактирования
// слала `image_url`, PostgREST отклонял ЗАПРОС ЦЕЛИКОМ (PGRST204,
// «Could not find the 'image_url' column»), и страница не сохраняла ничего —
// ни цену, ни описание. Компилятор при `Record<string, unknown>` молчал.
// С 05.09 выдуманного поля в `Item` больше нет — уезжать в запрос нечему.
//
// Сверено с `information_schema.columns` живой базы 13.08.2026.
export type ItemUpdate = Partial<Pick<
  Tables<'items'>,
  | 'title'
  | 'description'
  | 'category'
  | 'condition'
  | 'price_per_day'
  | 'price_3days'
  | 'price_week'
  | 'late_fee_per_day'
  | 'deposit'
  | 'photos'
  | 'lat'
  | 'lng'
  | 'address'
  | 'available'
  | 'quantity'
  | 'buffer_days'
  | 'min_notice_days'
  | 'delivery_fee'
  | 'delivery_radius_km'
>>;

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

  // Строка возвращается как есть: в кэш кладётся тот же объект, что вернул
  // PostgREST, а не переписанный "под форму" каркас. Это важно для тестов и
  // для корректного последующего редактирования без потери полей.
  return data;
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