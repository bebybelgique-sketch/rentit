// src/hooks/mutations/useUpdateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';

// Профиль лежит в таблице users (её id = auth.uid()), а не в profiles —
// такой таблицы в базе нет. Поля сверены со схемой: full_name, avatar_url,
// phone, village. Поля bio в базе нет, поэтому из типа оно убрано.
interface UpdateProfileParams {
  userId: string;
  updates: Partial<Omit<Profile, 'id'>>;
}

const updateProfile = async ({ userId, updates }: UpdateProfileParams): Promise<Profile> => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId) // RLS дополнительно ограничивает строку своим auth.uid()
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Profile update failed');

  return {
    id: data.id,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    phone: data.phone,
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
