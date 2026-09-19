// src/pages/Profile.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // Импортируем хук
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import { useUpdateProfile } from '../hooks/mutations/useUpdateProfile';
import { useDeleteAccount } from '../hooks/mutations/useDeleteAccount';
import { useUploadAvatar } from '../hooks/mutations/useUploadAvatar';
import toast from 'react-hot-toast';

const Profile: React.FC = () => {
  const { t } = useTranslation(); // Используем хук
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateProfileMutation = useUpdateProfile();
  const deleteAccountMutation = useDeleteAccount();
  const { upload: uploadAvatar, uploading: avatarUploading } = useUploadAvatar();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: storedProfile } = useProfile(user?.id);

  const [profileData, setProfileData] = useState({
    // Подстановки почты здесь БЫТЬ НЕ ДОЛЖНО. full_name — публичное поле:
    // миграция 07 разрешает читать его анониму, и оно подписывает владельца
    // на каждой странице вещи. Прежний запасной вариант `|| user?.email`
    // означал, что человек, открывший профиль и нажавший «сохранить», не
    // трогая имя, публиковал свой почтовый адрес. Проверено 12.08: в базе
    // такая строка уже была — её создал обычный путь через интерфейс.
    full_name: user?.user_metadata?.full_name || '',
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

  const isUnchanged =
    profileData.full_name.trim() === (storedProfile?.full_name || '').trim() &&
    profileData.avatar_url === (storedProfile?.avatar_url || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUnchanged) return;

    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        updates: {
          full_name: profileData.full_name.trim(),
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
      await supabase.auth.signOut().catch(() => {});
      queryClient.clear();
      toast.success(t('profile.deleteSuccess')); // Новая строка в i18n
      navigate('/', { replace: true });
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
                {/* Поле выбора файла скрыто, нажатие передаёт кнопка.
                    Сырой <input type="file"> рисует браузер, и на французском
                    экране он показывал «Choose File · No file chosen» —
                    английскую надпись, которую не переведёт ни один словарь, в
                    оформлении по умолчанию. Это был самый дешёвый на вид
                    элемент продукта, и стоял он на первом шаге профиля.
                    Приём не новый: ровно так устроен выбор снимков в форме
                    выкладки (ListItem.tsx, «Choisir des photos»). */}
                <input
                  id="avatar_file"
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarFile}
                  disabled={avatarUploading}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  style={{ minHeight: '44px' }}
                >
                  {t('profile.avatarChoose')}
                </button>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                  {avatarUploading ? t('profile.avatarUploading') : t('profile.avatarHint')}
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={updateProfileMutation.isPending || isUnchanged}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {updateProfileMutation.isPending ? t('profile.updating') : t('profile.updateButton')} {/* Новые строки в i18n */}
          </button>
        </form>

        {/* Вход в «Mes outils».
            Так в канве — на нижней панели пятого места нет, и раздел живёт
            строкой здесь. В продукте этой строки не было вовсе: на телефоне
            навбар прячет ссылку правилом `.navbar-link.hide-mobile`, и
            единственным входом оставалась страница своей же вещи. То есть
            найти свои вещи мог только тот, кто уже нашёл одну из них.
            «Mes locations» рядом не дублируется: этот раздел несёт панель. */}
        <Link
          to="/my-items"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            minHeight: '50px', marginTop: 'var(--space-6)', padding: '0 2px',
            borderTop: '1px solid var(--border)', fontSize: '15px',
            textDecoration: 'none', color: 'var(--text)',
          }}
        >
          {t('nav.myItems')}
          <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>›</span>
        </Link>

        <div style={{ marginTop: '40px', padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>{t('profile.dangerZoneTitle')}</h2> {/* Новая строка в i18n */}
          <p>{t('profile.dangerZoneDesc')}</p> {/* Новая строка в i18n */}
          <button
            onClick={handleDeleteAccount}
            className="btn btn-secondary"
            disabled={deleteAccountMutation.isPending}
            // Контур, а не заливка. Токены --action и --danger в этом продукте
            // — ОДИН И ТОТ ЖЕ #C8102E, поэтому залитая красным «Supprimer mon
            // compte» выглядела ровно как «Mettre à jour le profil» двумя
            // блоками выше: необратимое удаление учётки неотличимо от
            // сохранения имени.
            // Контурный вид для удаления в продукте уже принят — так нарисована
            // кнопка «Supprimer» в «Моих вещах» (MyItems.tsx). Здесь было
            // второе, расходящееся написание того же действия.
            // Разрушительное действие не должно быть самым заметным на экране:
            // оно должно быть найдено тем, кто его ищет, и не попасться тому,
            // кто его не искал.
            style={{ marginTop: '10px', color: 'var(--danger)', border: '1.5px solid var(--danger)', background: 'transparent' }}
          >
            {deleteAccountMutation.isPending ? t('profile.deleting') : t('profile.deleteButton')} {/* Новые строки в i18n */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;