import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { t } from '../i18n'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères')
    setLoading(true); setError('')

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name.trim() } },
    })

    if (error) { setError(error.message); setLoading(false); return }

    // Apply referral
    if (refCode && data.user) {
      const { data: referrer } = await supabase
        .from('users').select('id').eq('referral_code', refCode.toUpperCase()).single()
      if (referrer) {
        await supabase.from('users').update({ referred_by: referrer.id }).eq('id', data.user.id)
      }
    }

    navigate('/')
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
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{t('fullName')}</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Votre nom" />
            </div>
            <div className="form-group">
              <label>{t('email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label>{t('passwordMin')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
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
