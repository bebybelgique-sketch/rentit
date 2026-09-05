// src/hooks/mutations/useSetItemAvailability.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateItemCaches } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabase';

interface SetItemAvailabilityParams {
  id: string;
  /**
   * Каким состояние должно СТАТЬ. Инверсию делает вызывающий: хук, который
   * переворачивает значение сам, однажды переворачивает его дважды —
   * страница уже знает текущее состояние из кэша.
   */
  available: boolean;
}

// «Скрыть / показать» своё объявление.
//
// До 06.09 запрос жил ПРЯМО В СТРАНИЦЕ (MyItems.tsx): компонент сам звал
// supabase и сам правил кэш через setQueryData. Последствие было не
// стилистическое. Ручная правка описывала НАМЕРЕНИЕ («мы хотели скрыть»), а
// не ответ базы, и карточка вещи (['item', id]) не обновлялась вовсе: скрытая
// вещь оставалась доступной на своей странице до перезагрузки.
//
// Запрос тот же, что и был (`.update().eq()`, без `.select()`), а вместо
// записи в кэш — инвалидация: списки вещей и карточка этой вещи перечитываются
// из базы. Состояние, ПРИШЕДШЕЕ из базы, против состояния, которое мы
// собирались получить, — то же правило, по которому Admin.tsx перерисовывает
// бейдж из ответа сервера, а не из своих ожиданий.
const setItemAvailability = async ({ id, available }: SetItemAvailabilityParams): Promise<void> => {
  const { error } = await supabase.from('items').update({ available }).eq('id', id);
  if (error) throw new Error(error.message);
};

export const useSetItemAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setItemAvailability,
    onSuccess: (_result, variables) => {
      // Доступность меняет и списки вещей, и занятость дат на витрине.
      invalidateItemCaches(queryClient, variables.id);
    },
  });
};
