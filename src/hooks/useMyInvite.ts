// src/hooks/useMyInvite.ts
import { useQuery } from '@tanstack/react-query';
import { profileKeys } from '../lib/queryKeys';
import { supabase } from '../lib/supabase';

export type MyInvite = { code: string; joined: number };

/**
 * Свой код приглашения и сколько человек пришло по нему.
 *
 * Функцией, а не чтением колонки: с миграции 43 referral_code и
 * referred_by клиенту не читаются — прежде их видел любой аноним у всех
 * строк users. my_invite() отдаёт только своё и только число пришедших,
 * без имён.
 */
export function useMyInvite(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.invite(userId),
    enabled: !!userId,
    queryFn: async (): Promise<MyInvite | null> => {
      const { data, error } = await supabase.rpc('my_invite');
      if (error) throw error;
      const row = data?.[0];
      return row?.code ? { code: row.code, joined: row.joined ?? 0 } : null;
    },
  });
}
