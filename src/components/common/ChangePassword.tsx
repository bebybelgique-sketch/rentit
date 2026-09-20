// src/components/common/ChangePassword.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

/**
 * Смена пароля вошедшим человеком.
 *
 * ЧЕГО НЕ БЫЛО. `updateUser({ password })` в продукте существовал — на
 * странице ResetPassword. Но попасть туда можно ТОЛЬКО по ссылке из письма
 * восстановления, а писем продукт не шлёт: `RESEND_API_KEY` не задан.
 * То есть вошедший человек не мог сменить пароль НИКАК — не «неудобно», а
 * пути не существовало.
 *
 * ПОЧЕМУ СПРАШИВАЕМ ТЕКУЩИЙ ПАРОЛЬ. `updateUser` его не требует: хватает
 * действующей сессии. Значит любой, кто добрался до незапертого браузера,
 * менял пароль и запирал владельца снаружи — а тот об этом узнавал, только
 * когда не мог войти. Проверка делается входом с текущим паролем: это тот
 * же сервер и тот же ответ, что при обычном входе, никакой своей
 * «проверки» мы не выдумываем.
 *
 * ПОЧЕМУ ДВАЖДЫ НОВЫЙ. Опечатка в единственном поле — это потерянный
 * доступ к учётке, и заметит её человек не сразу, а при следующем входе.
 * Цена подтверждения — одно поле; цена ошибки — вся учётка.
 */
const MIN_LENGTH = 8;

const ChangePassword: React.FC<{ email: string }> = ({ email }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (next.length < MIN_LENGTH) return setError(t('passwordRecovery.tooShort'));
    if (next !== repeat) return setError(t('changePassword.mismatch'));
    // Новый пароль, совпавший со старым, — это не смена. Молча принять его
    // значило бы сказать «готово» там, где ничего не произошло.
    if (next === current) return setError(t('changePassword.sameAsOld'));

    setBusy(true);
    try {
      // 1. Подтверждение личности текущим паролем.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (authError) {
        setError(t('changePassword.wrongCurrent'));
        return;
      }

      // 2. Сама смена.
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        // Показываем причину от сервера, а не своё «что-то пошло не так»:
        // отказ по сложности пароля человек может исправить, только зная его.
        setError(updateError.message);
        return;
      }

      setCurrent(''); setNext(''); setRepeat('');
      toast.success(t('changePassword.done'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
        {t('changePassword.title')}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
        {t('changePassword.hint')}
      </p>

      {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

      <div className="form-group">
        <label htmlFor="pwd-current">{t('changePassword.currentLabel')}</label>
        <input
          id="pwd-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="pwd-next">{t('passwordRecovery.newLabel')}</label>
        <input
          id="pwd-next"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="pwd-repeat">{t('changePassword.repeatLabel')}</label>
        <input
          id="pwd-repeat"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      </div>

      <button
        type="submit"
        className="btn btn-secondary"
        disabled={busy || !current || !next || !repeat}
        style={{ minHeight: '44px' }}
      >
        {busy ? t('passwordRecovery.saving') : t('changePassword.submit')}
      </button>
    </form>
  );
};

export default ChangePassword;
