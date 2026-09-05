// src/hooks/useAdminStats.ts
import { useQuery } from '@tanstack/react-query';
import { invokeEdge } from '../lib/edgeInvoke';

// Счётчики площадки считает сервер служебным ключом — и только поэтому они
// верны. Прежняя вкладка Stats считала их запросами из браузера под правами
// самого администратора, а RLS на bookings и payments отдаёт ему ТОЛЬКО ЕГО
// строки: «Bookings» показывал число его собственных броней, «Revenue» —
// почти всегда ноль. Цифры были личные, подпись — общая, и отличить одно от
// другого на экране было нельзя.
//
// Выручки в наборе больше нет: платформа не берёт комиссию и не держит
// денег (инвариант из scripts/check-claims.mjs). Плитка «Revenue (platform
// fee)» обещала доход от модели, которой в продукте не существует.

export interface AdminStats {
  users: number;
  items: number;
  bookings: number;
  completed: number;
}

export const useAdminStats = (enabled: boolean) =>
  useQuery<AdminStats, Error>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const data = await invokeEdge<{ ok: boolean; stats: AdminStats }>('admin-action', {
        type: 'get_stats',
      });
      return data.stats;
    },
    // Пока роль не подтверждена, запрос не уходит: 403 в консоли на каждом
    // заходе постороннего — шум, который прячет настоящие ошибки.
    enabled,
    staleTime: 60000,
  });
