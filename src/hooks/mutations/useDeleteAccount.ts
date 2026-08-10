// src/hooks/mutations/useDeleteAccount.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase'; // Корректируем путь

const deleteAccount = async (userId: string): Promise<void> => {
  // Удаление аккаунта в Supabase - это комплексная операция.
  // В реальности она может включать:
  // 1. Пометку пользователя как удаленного (soft delete) с задержкой.
  // 2. Удаление всех его данных (вещи, аренды и т.д.) в каскаде через RLS или триггеры.
  // 3. Вызов специального RPC или Edge Function для безопасного удаления.

  // Для простоты, предположим, что есть RPC, который всё делает.
  // const { error } = await supabase.rpc('delete_user_account', { user_id: userId });

  // Или, если RLS настроены, можно попытаться удалить профиль, что может триггерить удаление связанных данных.
  // const { error } = await supabase.from('profiles').delete().match({ id: userId });

  // Наиболее распространенный способ - вызов метода аутентификации Supabase.
  // Это требует, чтобы пользователь был залогинен.
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) throw authError;

  // Дополнительно, можно удалить данные из других таблиц, если RLS не справилась.
  // const { error: profileError } = await supabase.from('profiles').delete().match({ id: userId });
  // if (profileError) throw profileError;
};

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      // После успешного удаления аккаунта, скорее всего, нужно разлогинить пользователя и перенаправить.
      // Это должно происходить в компоненте, который вызывает мутацию.
    },
  });
};