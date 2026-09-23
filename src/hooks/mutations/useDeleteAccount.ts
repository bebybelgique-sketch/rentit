// src/hooks/mutations/useDeleteAccount.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { invokeEdge } from '../../lib/edgeInvoke';

// Здесь стоял вызов supabase.auth.admin.deleteUser() из браузера. Он не мог
// работать: admin-API требует service_role-ключ, а положить его в клиент —
// значит отдать полный доступ к базе любому, кто откроет исходники страницы.
// Удаление делает edge-функция delete-account: она проверяет, что у человека
// нет активных броней ни как у арендатора, ни как у владельца (иначе 409),
// отвязывает историю и удаляет пользователя сервисным ключом.
const deleteAccount = async (): Promise<void> => {
  // Отказ — EdgeError с кодом (active_bookings_as_renter / _as_owner):
  // до 23.09 функция отвечала французской фразой для всех языков.
  await invokeEdge('delete-account', {});

  // Сессия удалённого пользователя больше не действительна — гасим её здесь,
  // чтобы интерфейс не остался с «призрачным» залогиненным состоянием.
  await supabase.auth.signOut();
};

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: deleteAccount,
  });
};
