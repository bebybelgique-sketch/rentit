// src/hooks/mutations/useDeleteItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingKeys, itemKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabase';

interface DeleteItemParams {
  id: string;
}

// Удаление своего объявления.
//
// Второй прямой запрос, который до 06.09 жил в MyItems.tsx вместе с ручной
// правкой кэша (`setQueryData` с фильтром списка). Подтверждение «вы
// уверены?» осталось в странице — это вопрос к человеку, а не к базе; здесь
// только запрос и последствия для кэша.
const deleteItem = async ({ id }: DeleteItemParams): Promise<{ id: string }> => {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { id };
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteItem,
    onSuccess: (_result, variables) => {
      // Карточку удалённой вещи ВЫБРАСЫВАЕМ из кэша, а не помечаем устаревшей:
      // инвалидация оставила бы в памяти строку, которой в базе больше нет, и
      // ItemDetail перечитал бы её в PGRST116 («Row not found»).
      queryClient.removeQueries({ queryKey: itemKeys.one(variables.id) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
      // Брони вещи удаляются вместе с ней (bookings.item_id — внешний ключ),
      // поэтому оба списка броней тоже устарели.
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
};
