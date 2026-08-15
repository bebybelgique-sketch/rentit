import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Куда человек шёл до того, как его попросили войти. Страж маршрута
  // кладёт это в state (см. RequireAuth в App.tsx).
  //
  // Раньше после входа всегда был navigate('/'): человек нажимал
  // «Déposer un outil», попадал на вход, входил — и оказывался на
  // лендинге, откуда ту же кнопку надо искать заново. На воронке
  // предложения, где каждый посетитель на счету, это лишний шаг ровно
  // в том месте, где его быть не должно.
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    // replace, а не push: страница входа не должна оставаться в истории
    // позади вошедшего человека — «назад» возвращало бы его на форму,
    // которую он уже прошёл.
    else navigate(from, { replace: true })
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '420px', margin: '40px auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '26px', fontWeight: '800', textAlign: 'center' }}>{t('loginTitle')}</h1>
        <div className="card">
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">{t('email')}</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">{t('password')}</label>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div style={{ textAlign: 'right', marginBottom: '16px', marginTop: '-8px' }}>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: '#999' }}>{t('forgotPassword')}</Link>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? t('loggingIn') : t('logIn')}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666', fontSize: '14px' }}>
            {t('noAccount')} <Link to="/register" style={{ fontWeight: '600' }}>{t('signUpLink')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
