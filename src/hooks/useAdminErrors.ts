// src/hooks/useAdminErrors.ts
import { useQuery } from '@tanstack/react-query';
import { invokeEdge } from '../lib/edgeInvoke';
import { adminKeys } from '../lib/queryKeys';

// Поломки в браузерах людей. Таблица закрыта для всех ролей клиента
// (миграция 41), поэтому читает admin-action служебным ключом — после
// проверки, что зовущий администратор ПО БАЗЕ, а не по токену.

export interface ClientErrorRow {
  fingerprint: string;
  day: string;
  kind: 'render' | 'promise' | 'window';
  message: string;
  stack: string | null;
  path: string;
  release: string | null;
  user_agent: string | null;
  lang: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
}

export const useAdminErrors = (enabled: boolean) =>
  useQuery<ClientErrorRow[], Error>({
    queryKey: adminKeys.errors,
    queryFn: async () => {
      const data = await invokeEdge<{ ok: boolean; errors: ClientErrorRow[] }>('admin-action', {
        type: 'get_errors',
      });
      return data.errors;
    },
    // Только когда вкладка открыта и роль подтверждена.
    enabled,
    staleTime: 30000,
  });
