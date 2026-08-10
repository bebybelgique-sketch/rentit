// src/hooks/mutations/useUpdateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase'; // Корректируем путь
import { Profile } from '../../types'; // Корректируем путь

interface UpdateProfileParams {
  userId: string;
  updates: Partial<Omit<Profile, 'id'>>; // Поля, которые можно обновить, исключая id
}

const updateProfile = async ({ userId, updates }: UpdateProfileParams): Promise<Profile> => {
  // Предполагаем, что профиль хранится в таблице 'profiles' с id, совпадающим с auth.user.id
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId) // match по id пользователя
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Profile update failed");

  // Преобразование данных из Supabase к типу Profile
  const mappedProfile: Profile = {
    id: data.id,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    bio: data.bio,
    // Добавьте другие поля профиля по мере необходимости
  };

  return mappedProfile;
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedProfile) => {
      // Инвалидируем кэш для профиля пользователя
      queryClient.invalidateQueries({ queryKey: ['profile', updatedProfile.id] });
      // Обновляем данные в AuthContext, если это необходимо
      // queryClient.setQueryData(['auth-user'], (oldData: any) => ({ ...oldData, user: { ...oldData.user, user_metadata: updatedProfile } }));
    },
  });
};