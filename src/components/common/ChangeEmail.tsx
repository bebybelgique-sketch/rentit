// src/components/common/ChangeEmail.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

/**
 * Смена почтового адреса.
 *
 * ЧЕГО НЕ БЫЛО. Адрес нельзя было сменить нигде. При этом он — логин:
 * вход идёт по нему, восстановление пароля идёт на него. Человек, сменивший
 * почту в жизни, терял доступ к учётке целиком и без всякого предупреждения.
 *
 * ТЕКУЩИЙ ПАРОЛЬ СПРАШИВАЕТСЯ ПО ТОЙ ЖЕ ПРИЧИНЕ, ЧТО И ПРИ СМЕНЕ ПАРОЛЯ.
 * `updateUser` довольствуется живой сессией. Подменить адрес — это увести
 * учётку насовсем: следом запрашивается восстановление пароля на новый
 * адрес, и владелец теряет всё. Подтверждение делается входом с текущим
 * паролем — тот же сервер и тот же ответ, что при обычном входе.
 *
 * ПОЧЕМУ ИСХОД ОПИСАН ДВУМЯ СЛУЧАЯМИ. Supabase решает САМ, нужно ли
 * подтверждение нового адреса — это настройка проекта, а не наш выбор.
 * Если подтверждение включено, `updateUser` возвращает пользователя со
 * СТАРЫМ адресом и шлёт письмо; если выключено — адрес меняется сразу.
 * Сказать «готово», когда на деле ушло письмо, значит соврать; сказать
 * «проверьте почту», когда письма не будет, — соврать тоже. Поэтому текст
 * выбирается по ФАКТУ: сравнением адреса в ответе с тем, что ввели.
 */
const ChangeEmail: React.FC<{ currentEmail: string }> = ({ currentEmail }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSentTo('');

    const next = email.trim().toLowerCase();
    if (next === currentEmail.trim().toLowerCase()) {
      return setError(t('changeEmail.sameAsCurrent'));
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (authError) {
        setError(t('changePassword.wrongCurrent'));
        return;
      }

      const { data, error: updateError } = await supabase.auth.updateUser({ email: next });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setPassword('');
      setEmail('');

      if (data.user?.email?.toLowerCase() === next) {
        // Подтверждение в проекте выключено — адрес уже новый.
        toast.success(t('changeEmail.doneNow'));
      } else {
        // Подтверждение включено: адрес сменится, когда человек откроет
        // ссылку. Говорим об этом прямо и НАЗЫВАЕМ адрес, на который ушло
        // письмо: опечатка в нём иначе выглядит как «письмо не приходит».
        setSentTo(next);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
        {t('changeEmail.title')}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
        {t('changeEmail.hint', { email: currentEmail })}
      </p>

      {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

      {sentTo && (
        <div
          className="card"
          style={{ marginBottom: '12px', padding: '12px 14px', fontSize: '14px' }}
        >
          {t('changeEmail.confirmSent', { email: sentTo })}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="email-next">{t('changeEmail.newLabel')}</label>
        <input
          id="email-next"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="email-password">{t('changePassword.currentLabel')}</label>
        <input
          id="email-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </div>

      <button
        type="submit"
        className="btn btn-secondary"
        disabled={busy || !email.trim() || !password}
        style={{ minHeight: '44px' }}
      >
        {busy ? t('passwordRecovery.saving') : t('changeEmail.submit')}
      </button>
    </form>
  );
};

export default ChangeEmail;
