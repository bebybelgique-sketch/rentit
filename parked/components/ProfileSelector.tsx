import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const STORAGE_KEY = 'rentit_profile_selected'

export default function ProfileSelector() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    // Only show on the landing page
    if (pathname !== '/') return
    const saved = localStorage.getItem(STORAGE_KEY)
    const cookieConsent = localStorage.getItem('rentit_cookie_consent')
    if (!saved && cookieConsent) {
      const timer = setTimeout(() => setVisible(true), 400)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  // Re-check when cookie consent is set (landing page only)
  useEffect(() => {
    if (pathname !== '/') return
    const interval = setInterval(() => {
      const saved = localStorage.getItem(STORAGE_KEY)
      const cookieConsent = localStorage.getItem('rentit_cookie_consent')
      if (!saved && cookieConsent) {
        setVisible(true)
        clearInterval(interval)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [pathname])

  const choose = (type: 'individual' | 'business') => {
    localStorage.setItem(STORAGE_KEY, type)
    setVisible(false)
    if (type === 'business') navigate('/business')
    else navigate('/browse')
  }

  if (!visible) return null

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }} />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9991,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          background: '#fff', borderRadius: '12px',
          width: '100%', maxWidth: '520px',
          padding: '40px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          fontFamily: 'var(--font-sans)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Welcome to
          </p>
          <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.04em', color: '#080808', marginBottom: '8px' }}>
            RentIt
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#080808', marginBottom: '6px' }}>
            Who are you?
          </h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px', lineHeight: 1.5 }}>
            Help us show you the right experience
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Individual */}
            <button
              onClick={() => choose('individual')}
              style={{
                background: '#fff', border: '2px solid #e8e6e0',
                borderRadius: '10px', padding: '24px 16px',
                cursor: 'pointer', textAlign: 'center',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#080808'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8e6e0'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔧</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#080808', marginBottom: '8px' }}>Individual</div>
              <div style={{ fontSize: '13px', color: '#888', lineHeight: 1.5 }}>
                Rent tools from neighbours or list your own tools
              </div>
            </button>

            {/* Business */}
            <button
              onClick={() => choose('business')}
              style={{
                background: '#fff', border: '2px solid #ADFF2F',
                borderRadius: '10px', padding: '24px 16px',
                cursor: 'pointer', textAlign: 'center',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(173,255,47,0.3)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏗️</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#080808', marginBottom: '8px' }}>Business</div>
              <div style={{ fontSize: '13px', color: '#888', lineHeight: 1.5 }}>
                B2B rental account for construction & professional teams
              </div>
            </button>
          </div>

          <button
            onClick={() => { localStorage.setItem(STORAGE_KEY, 'individual'); setVisible(false) }}
            style={{
              marginTop: '20px', background: 'none', border: 'none',
              color: '#aaa', fontSize: '13px', cursor: 'pointer',
              textDecoration: 'underline', fontFamily: 'var(--font-sans)',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </>
  )
}
