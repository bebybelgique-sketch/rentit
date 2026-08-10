// src/hooks/mutations/useDeleteItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface DeleteItemParams {
  itemId: string;
  userId: string; // Владелец товара
}

const deleteItemById = async ({ itemId, userId }: DeleteItemParams): Promise<void> => {
  // Проверка авторизации (псевдо-код для логики на фронтенде, RLS в БД является истинным источником прав)
  // Предполагается, что на бэкенде (в Supabase RLS) уже есть проверка, что пользователь может удалять только свои вещи.
  const { error } = await supabase
    .from('items')
    .delete()
    .match({ id: itemId, owner_id: userId }); // match может быть не нужен, если RLS строго ограничивает

  if (error) throw error;
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteItemById,
    onSuccess: (_, { itemId }) => {
      // Инвалидируем кэш для списка вещей пользователя
      queryClient.invalidateQueries({ queryKey: ['items'] }); // Общий ключ, можно сделать более конкретным, например ['items', userId]
      // Также удаляем конкретный элемент из кэша, если он был загружен
      queryClient.removeQueries({ queryKey: ['item', itemId] });
    },
  });
};