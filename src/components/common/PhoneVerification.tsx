// src/components/common/PhoneVerification.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { invokeEdge, EdgeError } from '../../lib/edgeInvoke';
import { serverErrorKey } from '../../domain/serverErrors';

/**
 * Телефон: ввод, код из SMS, подтверждение.
 *
 * ЧЕГО НЕ БЫЛО. Функция `verify-phone` развёрнута и активна, значок
 * «téléphone vérifié» показывается на странице вещи, а политика
 * конфиденциальности описывает сбор номера для OTP и передачу второй
 * стороне после подтверждённой брони. Экрана, на котором номер можно
 * ввести, не существовало НИ ОДНОГО. Значок нельзя было заработать, а
 * юридический документ описывал обработку, которой не происходило.
 *
 * ПОЧЕМУ НОМЕР ПОКАЗЫВАЕТСЯ ЗАМАСКИРОВАННЫМ. Колонка `phone` закрыта от
 * клиента миграцией 14 — PostgREST отвечает 401 даже на свою строку.
 * Открывать её обратно ради удобства значило бы вернуть то, что закрывали,
 * поэтому хвост номера отдаёт сама функция под служебным ключом.
 *
 * ПОЧЕМУ ЭКРАН ЕСТЬ ДО ТОГО, КАК ЗАВЕДЁН КАНАЛ. Инфраструктура строится
 * раньше ключей, а не после: иначе ключи некуда вставлять. Пока Twilio не
 * настроен, функция отвечает отдельным кодом `sms_not_configured`, и
 * человек читает «подтверждение по SMS пока недоступно» — состояние
 * продукта, а не обвинение в свой адрес.
 */
type Status = { phone: string | null; verified: boolean };
type Step = 'idle' | 'code-sent';

const PhoneVerification: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const showError = (err: unknown) => {
    const code = err instanceof EdgeError ? err.code : null;
    setError(t(serverErrorKey(code)));
  };

  const loadStatus = async () => {
    try {
      setStatus(await invokeEdge<Status>('verify-phone', { action: 'status' }));
    } catch {
      // Молчим НАМЕРЕННО: не узнать статус — не повод ронять весь профиль
      // сообщением об ошибке. Блок просто предложит ввести номер.
      setStatus({ phone: null, verified: false });
    }
  };

  useEffect(() => { void loadStatus(); }, []);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await invokeEdge('verify-phone', { action: 'send', phone: phone.trim() });
      setStep('code-sent');
      toast.success(t('phoneVerify.codeSent'));
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await invokeEdge('verify-phone', { action: 'verify', otp: code.trim() });
      setStep('idle');
      setCode('');
      setPhone('');
      await loadStatus();
      toast.success(t('phoneVerify.verified'));
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <div style={{ marginTop: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>{t('phoneVerify.title')}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
        {t('phoneVerify.title')}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
        {t('phoneVerify.why')}
      </p>

      {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

      {/* Текущее состояние названо прямо. «Номер есть, но не подтверждён» —
          отдельное состояние от «номера нет»: в первом случае человек уже
          что-то сделал, и говорить ему «добавьте номер» значит не заметить
          его работу. */}
      {status.phone && (
        <p style={{ fontSize: '14px', marginBottom: '16px', fontFamily: 'var(--font-mono)' }}>
          {status.phone}
          {' · '}
          <span style={{ color: status.verified ? 'var(--success, #2e7d32)' : 'var(--muted)' }}>
            {status.verified ? t('phoneVerify.stateVerified') : t('phoneVerify.stateUnverified')}
          </span>
        </p>
      )}

      {step === 'idle' ? (
        <form onSubmit={sendCode}>
          <div className="form-group">
            <label htmlFor="phone-number">
              {status.phone ? t('phoneVerify.changeLabel') : t('phoneVerify.addLabel')}
            </label>
            <input
              id="phone-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+32470123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              style={{ width: '100%' }}
            />
            {/* Формат назван заранее. Отказ «неверный номер» после нажатия —
                это загадка, которую человек разгадывает перебором. */}
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
              {t('phoneVerify.formatHint')}
            </p>
          </div>
          <button type="submit" className="btn btn-secondary" disabled={busy || !phone.trim()} style={{ minHeight: '44px' }}>
            {busy ? t('phoneVerify.sending') : t('phoneVerify.sendCode')}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmCode}>
          <div className="form-group">
            <label htmlFor="phone-code">{t('phoneVerify.codeLabel')}</label>
            <input
              id="phone-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              style={{ width: '100%', fontFamily: 'var(--font-mono)', letterSpacing: '0.3em' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
              {t('phoneVerify.codeHint')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-secondary" disabled={busy || code.length !== 6} style={{ minHeight: '44px' }}>
              {busy ? t('phoneVerify.checking') : t('phoneVerify.confirm')}
            </button>
            {/* Выход из шага кода. Без него человек, ошибшийся номером,
                застревает: код не придёт никогда, а вернуться некуда. */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setStep('idle'); setCode(''); setError(''); }}
              disabled={busy}
              style={{ minHeight: '44px' }}
            >
              {t('phoneVerify.changeNumber')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PhoneVerification;
