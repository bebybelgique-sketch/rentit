// src/hooks/useProfile.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProfileSummary } from '../types';

// Столбцы перечислены поимённо, и это обязательно: у роли authenticated нет
// ТАБЛИЧНОГО права SELECT на public.users (миграция 07 сняла его нарочно,
// чтобы скрыть phone_otp и stripe_customer_id). Пустой .select() ушёл бы как
// select=* и вернул 403 — этот же промах уже стоил нам сохранения профиля.
//
// phone не запрашивается: миграция 14 сняла SELECT (phone, lat, lng) и с
// authenticated тоже, так что человек не читает даже свой номер.
const COLUMNS = 'id, full_name, avatar_url, village';

/**
 * Профиль из таблицы users — источника, который и показывается другим.
 *
 * Форма профиля раньше заполнялась из user_metadata, а сохраняла в users.
 * Два разных места: у человека с давно сохранённым именем поле выглядело
 * пустым, а подстановка `|| user.email` закрывала эту пустоту его почтой —
 * и публиковала её, потому что full_name читается анонимом.
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileSummary | null> => {
      const { data, error } = await supabase
        .from('users')
        .select(COLUMNS)
        .eq('id', userId!)
        .maybeSingle();

      if (error) throw error;
      // Строка возвращается как есть: COLUMNS перечисляет ровно те четыре
      // колонки, из которых собран ProfileSummary, поэтому маппера здесь нет.
      // Он стоял до 06.09 и подставлял `full_name ?? ''` — умолчание вместо
      // значения, которое колонка NOT NULL и так гарантирует.
      return data ?? null;
    },
  });
}
