// src/hooks/mutations/useCreateRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateBookingCaches } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabase';

// Заявку на аренду НЕЛЬЗЯ создать из браузера: политика вставки в bookings
// удалена миграцией 20260328000009_bookings_insert_lockdown. Брони создаёт
// edge-функция request-rental сервисным ключом — она же проверяет, что вещь
// не своя, что даты свободны, ставит статус pending_approval и шлёт письма.
// Цену считает сервер, поэтому total_price с клиента не передаётся.
interface CreateRentalParams {
  item_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  message?: string;
  // Только сам выбор: цену доставки сервер берёт из вещи и кладёт в бронь
  // снимком — по той же причине, по какой не принимает total_price.
  delivery_requested?: boolean;
}

const createRental = async (params: CreateRentalParams): Promise<{ booking_id: string }> => {
  const { data, error } = await supabase.functions.invoke<{ booking_id?: string; error?: string }>(
    'request-rental',
    { body: params }
  );

  // Функция отвечает 4xx с телом { error }: supabase-js кладёт это в error,
  // но текст причины лежит в теле, поэтому разбираем оба источника.
  if (error) throw new Error(data?.error || error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.booking_id) throw new Error('request-rental не вернул booking_id');

  return { booking_id: data.booking_id };
};

export const useCreateRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRental,
    onSuccess: () => {
      // Новая заявка меняет и свои брони, и вещи владельца: до 06.09 здесь
      // не было ни ['rentalsAsOwner'], ни ключа «Моих вещей» — владелец
      // видел заявку только после перезагрузки страницы.
      invalidateBookingCaches(queryClient);
    },
  });
};
