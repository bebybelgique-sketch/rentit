// src/hooks/mutations/useCreateRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Rental } from '../../types';

interface CreateRentalParams {
  item_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  renter_id: string;
  message?: string; // Добавляем опциональное поле сообщения
}

const createRental = async (params: CreateRentalParams): Promise<Rental> => {
  const { item_id, start_date, end_date, total_price, renter_id, message } = params;
  const { data, error } = await supabase
    .from('rentals') // Предполагаем, что таблица rentals
    .insert([{
      item_id,
      start_date,
      end_date,
      total_price,
      renter_id,
      status: 'pending', // Устанавливаем статус по умолчанию
      message: message || null, // Сохраняем сообщение, если есть
    }])
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Rental creation failed");

  // Здесь нужно будет преобразовать `data` к типу `Rental`, если `Rental` отличается от структуры ответа Supabase.
  // Для простоты, предположим, что структура совпадает.
  return data as unknown as Rental; // Явное приведение типа
};

export const useCreateRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRental,
    onSuccess: () => {
      // Инвалидируем и обновляем связанные данные, например, аренды пользователя
      queryClient.invalidateQueries({ queryKey: ['rentals'] }); // Общий ключ для всех аренд
      // queryClient.invalidateQueries({ queryKey: ['rentals', newRental.renter_id] }); // Конкретный пользователь
      // queryClient.invalidateQueries({ queryKey: ['items'] }); // Список вещей может зависеть от аренд
    },
  });
};