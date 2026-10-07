// src/hooks/useAdminUsage.ts
import { useQuery } from '@tanstack/react-query';
import { invokeEdge } from '../lib/edgeInvoke';
import { adminKeys } from '../lib/queryKeys';
import type { UsageRow } from '../domain/usage';

// Дневные счётчики использования. Таблица закрыта для всех ролей клиента
// (миграция 62), поэтому читает admin-action служебным ключом — после
// проверки, что зовущий администратор ПО БАЗЕ, а не по токену.

export const useAdminUsage = (enabled: boolean) =>
  useQuery<UsageRow[], Error>({
    queryKey: adminKeys.usage,
    queryFn: async () => {
      const data = await invokeEdge<{ ok: boolean; usage: UsageRow[] }>('admin-action', {
        type: 'get_usage',
      });
      return data.usage;
    },
    enabled,
    staleTime: 60000,
  });
