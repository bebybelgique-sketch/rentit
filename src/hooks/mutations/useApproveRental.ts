// src/hooks/mutations/useApproveRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase'; // Корректируем путь
import { Rental } from '../../../types'; // Корректируем путь

interface ApproveRentalParams {
  rentalId: string;
  userId: string; // Владелец вещи, который подтверждает
}

const approveRental = async ({ rentalId, userId }: ApproveRentalParams): Promise<Rental> => {
  // Проверка авторизации (RLS в БД должна ограничивать)
  const { data, error } = await supabase
    .from('rentals')
    .update({ status: 'approved' }) // Предполагаем, что статус 'approved' существует
    .match({ id: rentalId }) // Сопоставление с ID аренды
    // .match({ 'items.owner_id': userId }) // Возможно, потребуется дополнительная проверка через join, если RLS не позволяет обновлять только по id аренды
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Rental approval failed");

  return data as unknown as Rental; // Явное приведение типа
};

export const useApproveRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveRental,
    onSuccess: (updatedRental) => {
      // Инвалидируем кэш для аренд, чтобы обновить список
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentalsAsOwner'] });
      // queryClient.invalidateQueries({ queryKey: ['rentals', updatedRental.renter_id] });
      // queryClient.setQueryData(['rental', updatedRental.id], updatedRental);
    },
  });
};