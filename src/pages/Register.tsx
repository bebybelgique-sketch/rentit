import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError(t('register.passwordMinimum'))
    setLoading(true); setError(''); setSuccess('')

    let referrerId: string | null = null
    if (refCode) {
      const { data: referrer, error: referrerError } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', refCode.toUpperCase())
        .maybeSingle()

      if (referrerError) {
        console.error('Referral lookup failed', referrerError)
      }
      if (referrer) referrerId = referrer.id
    }

    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: name.trim(),
          ...(referrerId ? { referred_by: referrerId } : {}),
        },
      },
    })

    if (error) { setError(error.message); setLoading(false); return }

    setSuccess(t('register.checkInbox'))
    navigate('/login', { replace: true })
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '420px', margin: '40px auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '26px', fontWeight: '800', textAlign: 'center' }}>{t('joinRentIt')}</h1>
        <div className="card">
          {refCode && (
            <div className="success-msg" style={{ marginBottom: '16px' }}>
              {t('invitedMsg')}
            </div>
          )}
          {success && <div className="success-msg" style={{ marginBottom: '16px' }}>{success}</div>}
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reg-name">{t('fullName')}</label>
              {/* type="text" задан явно: без атрибута свойство в JS всё
                  равно 'text', но CSS-селектор `input[type="text"]` мимо —
                  на этом 14.08 споткнулась моя же проверочная оснастка и
                  выдала «регистрация сломана», хотя ломалась она сама. */}
              <input id="reg-name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={t('register.namePlaceholder')} autoComplete="name" />
            </div>
            <div className="form-group">
              <label htmlFor="reg-email">{t('email')}</label>
              <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">{t('passwordMin')}</label>
              <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? t('creatingAccount') : t('createAccount')}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666', fontSize: '14px' }}>
            {t('alreadyAccount')} <Link to="/login" style={{ fontWeight: '600' }}>{t('logInLink')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
