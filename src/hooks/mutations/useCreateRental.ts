// src/hooks/mutations/useCreateRental.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateBookingCaches } from '../../lib/queryKeys';
import { invokeEdge } from '../../lib/edgeInvoke';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';

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
  // Оператор — так же: только выбор, сумму сервер берёт из вещи.
  operator_requested?: boolean;
  // Сколько дней работает оператор (1…длина брони); по умолчанию — вся бронь.
  operator_days?: number;
}

// Суммы, которые сервер записал в бронь, — для экрана «Demande envoyée»:
// именно их увидит и примет владелец.
export type SentBooking = Pick<
  Database['public']['Tables']['bookings']['Row'],
  'total_price' | 'deposit_amount' | 'delivery_requested' | 'delivery_fee'
  | 'operator_requested' | 'operator_fee' | 'operator_days'
>;

// Не прочиталось — null, а не ошибка: заявка к этому моменту уже создана, и
// упавшая мутация сказала бы «ошибка» о заявке, которая ушла.
const readSent = async (bookingId: string): Promise<SentBooking | null> => {
  try {
    const { data } = await supabase
      .from('bookings')
      .select('total_price, deposit_amount, delivery_requested, delivery_fee, operator_requested, operator_fee, operator_days')
      .eq('id', bookingId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
};

const createRental = async (
  params: CreateRentalParams,
): Promise<{ booking_id: string; sent: SentBooking | null }> => {
  // Отказ — EdgeError с кодом функции (dates_unavailable, duplicate_request…);
  // текст подбирает экран через src/lib/errorText.ts.
  const data = await invokeEdge<{ booking_id?: string }>('request-rental', { ...params });
  if (!data.booking_id) throw new Error('request-rental не вернул booking_id');

  // Снимок читается внутри мутации, чтобы isPending держал кнопку занятой до
  // конца: второе нажатие в этот промежуток было бы второй заявкой.
  return { booking_id: data.booking_id, sent: await readSent(data.booking_id) };
};

export const useCreateRental = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRental,
    // Сбой показывает место вызова — ItemDetail: причина у кнопки заявки.
    meta: { errorShownBy: 'caller' },
    onSuccess: () => {
      // Новая заявка меняет и свои брони, и вещи владельца: до 06.09 здесь
      // не было ни ['rentalsAsOwner'], ни ключа «Моих вещей» — владелец
      // видел заявку только после перезагрузки страницы.
      return invalidateBookingCaches(queryClient);
    },
  });
};
