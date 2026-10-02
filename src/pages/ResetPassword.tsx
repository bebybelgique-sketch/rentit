import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authErrorKey } from '../domain/authErrors'
import { supabase } from '../lib/supabase'
import { authRedirect } from '../lib/authRedirect'
import { usePageTitle } from '../hooks/usePageTitle'

// Вторая половина пути восстановления пароля, тоже была целиком
// по-английски. См. комментарий в ForgotPassword.tsx.
export default function ResetPassword() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.resetPassword'))
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // checking — ждём, чем кончился разбор ссылки; ready — можно задать
  // пароль; invalid — ссылка не годится, и это надо сказать, а не ждать.
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>(
    authRedirect.error ? 'invalid' : 'checking',
  )

  useEffect(() => {
    if (state !== 'checking') return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setState('ready'); return }
      if (event !== 'INITIAL_SESSION') return
      // INITIAL_SESSION приходит, когда auth-js уже разобрал ссылку. Событие
      // восстановления могло уйти раньше нашей подписки — страница грузится
      // лениво, — поэтому решаем по сессии: годится ТОЛЬКО та, что пришла из
      // этой ссылки (токен совпадает). Любая другая — нет: иначе вошедший
      // задал бы новый пароль без текущего, мимо проверки в ChangePassword.
      const fromThisLink = !!authRedirect.recoveryToken && session?.access_token === authRedirect.recoveryToken
      setState(fromThisLink ? 'ready' : 'invalid')
    })
    return () => subscription.unsubscribe()
  }, [state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError(t('passwordRecovery.tooShort'))
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(t(authErrorKey(error))); setLoading(false) }
    else navigate('/profile')
  }

  if (state === 'checking') {
    return (
      <div className="page">
        <div style={{ maxWidth: '420px', margin: '40px auto', textAlign: 'center' }}>
          <div className="loading">{t('passwordRecovery.verifying')}</div>
        </div>
      </div>
    )
  }

  // Просрочена, уже использована, открыта не та — выход должен быть: новая
  // ссылка в один шаг, а не вечное ожидание.
  if (state === 'invalid') {
    return (
      <div className="page">
        <div className="card" role="alert" style={{ maxWidth: '420px', margin: '40px auto', textAlign: 'center' }}>
          <p style={{ marginBottom: '20px', lineHeight: 1.6 }}>{t('passwordRecovery.linkInvalid')}</p>
          <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'inline-block', minHeight: '44px' }}>
            {t('passwordRecovery.requestNew')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '420px', margin: '40px auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '24px', fontWeight: '800', textAlign: 'center' }}>
          {t('passwordRecovery.newTitle')}
        </h1>
        <div className="card">
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reset-password">{t('passwordRecovery.newLabel')}</label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? t('passwordRecovery.saving') : t('passwordRecovery.save')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
