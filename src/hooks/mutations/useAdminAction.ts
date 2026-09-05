// src/hooks/mutations/useAdminAction.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { itemKeys, profileKeys } from '../../lib/queryKeys';
import { invokeEdge } from '../../lib/edgeInvoke';

// Единственный путь для действий администратора над чужими строками.
//
// Прямого `supabase.from('users').update({ role })` из браузера больше нет
// и быть не может: грант на UPDATE выдан поимённо на шесть столбцов
// профиля (миграция 20260812000017), роли в этом списке нет. Кнопка в
// /admin три недели нажималась вхолостую именно поэтому — база отвечала
// «обновлено ноль строк», а клиент считал это успехом и рисовал новый
// бейдж, который исчезал после перезагрузки страницы.
//
// Типы ниже повторяют supabase/functions/admin-action/actions.ts. Общего
// модуля у браузера и Deno-функции здесь нет намеренно: разделяемый код
// живёт в _shared только когда это ПРАВИЛО (цена, доступность), а не
// форма запроса. Расхождение поймает сервер — неизвестное действие он
// отвергает, а не трактует.

export type AdminAction =
  | { type: 'set_user_role'; user_id: string; role: 'user' | 'admin' }
  | { type: 'set_item_available'; item_id: string; available: boolean };

export interface AdminActionResult {
  ok: true;
  /** Пришедшее из базы состояние строки — показываем его, а не ожидаемое. */
  user?: { id: string; role: string };
  item?: { id: string; available: boolean };
}

export const useAdminAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: AdminAction) => invokeEdge<AdminActionResult>('admin-action', action),
    onSuccess: (_data, action) => {
      // Скрытое администратором объявление обязано пропасть из витрины и
      // со своей страницы — иначе человек откроет ссылку из поиска и
      // увидит вещь, которой в каталоге уже нет.
      if (action.type === 'set_item_available') {
        void queryClient.invalidateQueries({ queryKey: itemKeys.all });
        void queryClient.invalidateQueries({ queryKey: itemKeys.one(action.item_id) });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: profileKeys.one(action.user_id) });
    },
  });
};
