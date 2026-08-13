// src/pages/Profile.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next'; // Импортируем хук
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useUpdateProfile } from '../hooks/mutations/useUpdateProfile';
import { useDeleteAccount } from '../hooks/mutations/useDeleteAccount';
import { useUploadAvatar } from '../hooks/mutations/useUploadAvatar';
import toast from 'react-hot-toast';

const Profile: React.FC = () => {
  const { t } = useTranslation(); // Используем хук
  const { user } = useAuth();
  const updateProfileMutation = useUpdateProfile();
  const deleteAccountMutation = useDeleteAccount();
  const { upload: uploadAvatar, uploading: avatarUploading } = useUploadAvatar();

  const { data: storedProfile } = useProfile(user?.id);

  const [profileData, setProfileData] = useState({
    // Подстановки почты здесь БЫТЬ НЕ ДОЛЖНО. full_name — публичное поле:
    // миграция 07 разрешает читать его анониму, и оно подписывает владельца
    // на каждой странице вещи. Прежний запасной вариант `|| user?.email`
    // означал, что человек, открывший профиль и нажавший «сохранить», не
    // трогая имя, публиковал свой почтовый адрес. Проверено 12.08: в базе
    // такая строка уже была — её создал обычный путь через интерфейс.
    full_name: user?.user_metadata?.full_name || '',
    bio: user?.user_metadata?.bio || '',
    avatar_url: user?.user_metadata?.avatar_url || '',
  });

  // Форма заполнялась из user_metadata, а сохраняла в таблицу users. Два
  // разных места: у человека с давно сохранённым именем поле выглядело
  // пустым, и он «терял» его при каждом сохранении. Показываем то, что
  // действительно лежит в базе и видно другим.
  useEffect(() => {
    if (!storedProfile) return;
    setProfileData(prev => ({
      ...prev,
      full_name: storedProfile.full_name || prev.full_name,
      avatar_url: storedProfile.avatar_url || prev.avatar_url,
    }));
  }, [storedProfile]);

  if (!user) {
    return (
      <div className="page">
        <div className="loading">{t('profile.loginRequired')}</div> {/* Новая строка в i18n */}
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  // Снимок сохраняется СРАЗУ, не дожидаясь кнопки «сохранить».
  //
  // Иначе человек выбирает файл, видит новое лицо в кружке, уходит со
  // страницы — и аватар не сохранён, хотя выглядел сохранённым. Тот же
  // класс, что «интерфейс сообщает об исходе, которого не было».
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = ''; // чтобы выбор того же файла второй раз тоже сработал

    const result = await uploadAvatar(file, user.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    try {
      // Поля перечислены поимённо, а не `...profileData`. В состоянии формы
      // живёт ещё и `bio`, а колонки `bio` в таблице `users` НЕТ — PostgREST
      // отклонил бы весь запрос целиком (PGRST204), файл лёг бы в бакет, а
      // ссылка не сохранилась. Ровно то, что чинили в PR #19 на странице
      // «Modifier»: одно лишнее поле — и не сохраняется ничего.
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        updates: { full_name: profileData.full_name, avatar_url: result.url },
      });
      setProfileData(prev => ({ ...prev, avatar_url: result.url }));
      toast.success(t('profile.avatarSaved'));
    } catch (err: any) {
      // Файл уже в бакете, а ссылка не записалась: показать «готово» здесь
      // значило бы соврать — при перезагрузке аватар исчезнет.
      toast.error(err?.message || t('profile.avatarSaveFailed'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        updates: {
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
        }
      });
      toast.success(t('profile.updateSuccess')); // Новая строка в i18n
    } catch (error: any) {
      console.error(t('profile.updateError'), error);
      toast.error(error.message || t('profile.updateError')); // Новая строка в i18n
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('profile.deleteConfirm'))) { // Новая строка в i18n
      return;
    }

    try {
      await deleteAccountMutation.mutateAsync();
      toast.success(t('profile.deleteSuccess')); // Новая строка в i18n
      // Здесь нужно выполнить разлогин и перенаправление
      // await supabase.auth.signOut(); // Это может быть вызвано в AuthContext
      // navigate('/'); // Перенаправление на главную
    } catch (error: any) {
      console.error(t('profile.deleteError'), error);
      toast.error(error.message || t('profile.deleteError')); // Новая строка в i18n
    }
  };

  return (
    <div className="page">
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>{t('profile.title')}</h1> {/* Новая строка в i18n */}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="full_name">{t('profile.fullName')}</label> {/* Новая строка в i18n */}
            <input
              id="full_name"
              name="full_name"
              type="text"
              value={profileData.full_name}
              onChange={handleChange}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">{t('profile.biography')}</label> {/* Новая строка в i18n */}
            <textarea
              id="bio"
              name="bio"
              value={profileData.bio}
              onChange={handleChange}
              style={{ width: '100%' }}
            />
          </div>

          {/* Фотография профиля. Прежде здесь стояло текстовое поле с
              адресом: человек должен был сам где-то разместить снимок. Бакет
              и политики записи существовали с самого начала — не было формы. */}
          <div className="form-group">
            <label htmlFor="avatar_file">{t('profile.avatarLabel')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              {profileData.avatar_url ? (
                <img
                  src={profileData.avatar_url}
                  alt=""
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{ width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0, background: 'var(--bg)', border: '1px dashed var(--border)' }}
                />
              )}
              <div style={{ flex: 1 }}>
                <input
                  id="avatar_file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarFile}
                  disabled={avatarUploading}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                  {avatarUploading ? t('profile.avatarUploading') : t('profile.avatarHint')}
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={updateProfileMutation.isPending}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {updateProfileMutation.isPending ? t('profile.updating') : t('profile.updateButton')} {/* Новые строки в i18n */}
          </button>
        </form>

        <div style={{ marginTop: '40px', padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>{t('profile.dangerZoneTitle')}</h2> {/* Новая строка в i18n */}
          <p>{t('profile.dangerZoneDesc')}</p> {/* Новая строка в i18n */}
          <button
            onClick={handleDeleteAccount}
            className="btn btn-secondary"
            disabled={deleteAccountMutation.isPending}
            style={{ marginTop: '10px', backgroundColor: 'var(--danger)', color: 'white' }}
          >
            {deleteAccountMutation.isPending ? t('profile.deleting') : t('profile.deleteButton')} {/* Новые строки в i18n */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;