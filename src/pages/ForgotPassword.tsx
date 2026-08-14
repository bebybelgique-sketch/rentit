import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

// Страница была целиком по-английски на французском продукте: «Reset
// password», «Back to login», «Email address». Перенос 121 строки в
// словари (#30) её не задел — гейт `check-i18n-keys` видит только t(),
// а захардкоженная строка для него невидима в принципе.
// Хуже места не придумать: сюда человек попадает, уже потеряв доступ.
export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '420px', margin: '40px auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '24px', fontWeight: '800', textAlign: 'center' }}>
          {t('passwordRecovery.requestTitle')}
        </h1>
        <div className="card">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                {t('passwordRecovery.sentText')}
              </p>
              <Link to="/login" className="btn btn-primary">{t('passwordRecovery.backToLogin')}</Link>
            </div>
          ) : (
            <>
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="forgot-email">{t('passwordRecovery.emailLabel')}</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? t('passwordRecovery.sending') : t('passwordRecovery.submit')}
                </button>
              </form>
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px' }}>
                <Link to="/login" style={{ color: 'var(--text-secondary)' }}>
                  {t('passwordRecovery.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
