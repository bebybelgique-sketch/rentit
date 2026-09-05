// src/hooks/mutations/useUpdateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Profile } from '../../types';

// Профиль лежит в таблице users (её id = auth.uid()), а не в profiles —
// такой таблицы в базе нет. Поля сверены со схемой: full_name, avatar_url,
// phone, village. Поля bio в базе нет, поэтому из типа оно убрано.
interface UpdateProfileParams {
  userId: string;
  updates: Database['public']['Tables']['users']['Update'];
}

// Столбцы перечислены поимённо, и это обязательно, а не стилистика.
//
// Пустой .select() превращается в `select=*`, а PostgREST шлёт `RETURNING *`.
// Звёздочка требует ТАБЛИЧНОГО права SELECT, которого у роли authenticated на
// public.users нет: миграция 07 сняла его нарочно и выдала права по столбцам,
// чтобы скрыть phone_otp и stripe_customer_id. Поэтому запрос возвращал
// 403 / 42501 «permission denied for table users» — Postgres прямо подсказывал
// GRANT SELECT ON public.users, но выдавать его нельзя: это открыло бы
// служебные столбцы обратно.
//
// Цена ошибки была не косметическая: профиль не сохранялся ни у кого, а без
// аватара ListItem не отдаёт форму — ни один новый пользователь не мог
// выложить инструмент.
//
// phone здесь НЕ запрашивается: миграция 14 сняла SELECT (phone, lat, lng)
// и с authenticated тоже, так что человек не читает даже свой номер. Тип
// Profile объявляет phone необязательным, поэтому пропуск законен.
const RETURNING_COLUMNS = 'id, full_name, avatar_url, village';

const updateProfile = async ({ userId, updates }: UpdateProfileParams): Promise<Profile> => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId) // RLS дополнительно ограничивает строку своим auth.uid()
    .select(RETURNING_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Profile update failed');

  return {
    id: data.id,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    village: data.village,
  };
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: ['profile', updatedProfile.id] });
    },
  });
};
