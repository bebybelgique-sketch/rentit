import React, { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
import { authErrorKey } from '../domain/authErrors'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Register() {
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.register'))
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Куда человек шёл, когда его попросили войти, — страж маршрута кладёт
  // это в state входа, а вход передаёт сюда (ссылка «S'inscrire»).
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const refCode = searchParams.get('ref') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError(t('register.passwordMinimum'))
    setLoading(true); setError('')

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

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: name.trim(),
          ...(referrerId ? { referred_by: referrerId } : {}),
        },
      },
    })

    if (error) { setError(t(authErrorKey(error))); setLoading(false); return }

    // ДВА ИСХОДА — и до 23.09 оба вели на вход.
    //
    // Подтверждение почты в проекте ВЫКЛЮЧЕНО, и signUp сразу отдаёт
    // сессию: человек УЖЕ вошёл. Прежде его отправляли на форму входа с
    // надписью «проверьте почту» — письма нет и не будет, а сам он
    // вошедшим стоял перед просьбой войти. Намерение терялось: нажавший
    // «Déposer un outil» оказывался далеко от формы. Замерено на живом
    // сайте в роли нового соседа с телефона.
    //
    // Есть сессия — туда, куда шёл. Нет (подтверждение однажды включат) —
    // на вход, и просьба проверить почту стоит ТАМ, где её видно: прежде
    // она ставилась здесь за миг до ухода со страницы и не показывалась.
    if (data.session) navigate(from, { replace: true })
    else navigate('/login', { replace: true, state: { from, notice: 'checkInbox' } })
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
