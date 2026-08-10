// src/hooks/mutations/useRejectRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase'; // Корректируем путь
import { Rental } from '../../types'; // Корректируем путь

interface RejectRentalParams {
  rentalId: string;
  userId: string; // Владелец вещи, который отклоняет
}

const rejectRental = async ({ rentalId }: RejectRentalParams): Promise<Rental> => {
  // Проверка авторизации (RLS в БД должна ограничивать)
  const { data, error } = await supabase
    .from('rentals')
    .update({ status: 'rejected' }) // Предполагаем, что статус 'rejected' существует
    .match({ id: rentalId }) // Сопоставление с ID аренды
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Rental rejection failed");

  return data as unknown as Rental; // Явное приведение типа
};

export const useRejectRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectRental,
    onSuccess: () => {
      // Инвалидируем кэш для аренд, чтобы обновить список
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentalsAsOwner'] });
      // queryClient.invalidateQueries({ queryKey: ['rentals', updatedRental.renter_id] });
      // queryClient.setQueryData(['rental', updatedRental.id], updatedRental);
    },
  });
};