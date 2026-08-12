import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Consent = { necessary: true; functional: boolean; analytics: boolean }

const STORAGE_KEY = 'rentit_cookie_consent'

export default function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [functional, setFunctional] = useState(true)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const save = (consent: Consent) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)) } catch { /* blocked */ }
    setVisible(false)
  }

  const acceptAll = () => save({ necessary: true, functional: true, analytics: true })
  const rejectAll = () => save({ necessary: true, functional: false, analytics: false })
  const saveCustom = () => save({ necessary: true, functional, analytics })

  if (!visible) return null

  return (
    <>
      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'center',
        padding: '0 16px 16px',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '4px 4px 0 0',
          width: '100%', maxWidth: '520px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          fontFamily: 'var(--font-sans)',
          overflow: 'hidden',
          pointerEvents: 'all',
        }}>

          {/* Top accent bar */}
          <div style={{ height: '3px', background: '#080808' }} />

          <div style={{ padding: '32px' }}>
            {!expanded ? (
              <>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {t('cookies.header')}
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#080808', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>
                      {t('cookies.title')}
                    </h2>
                  </div>
                  <span style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.03em', color: '#080808', flexShrink: 0, marginLeft: '16px', paddingTop: '18px' }}>
                    Rent<span style={{ color: '#ADFF2F', WebkitTextStroke: '1px #080808' }}>It</span>
                  </span>
                </div>

                <p style={{ fontSize: '14px', color: '#555', marginBottom: '20px', lineHeight: 1.65 }}>
                  {t('cookies.lede')}{' '}
                  <Link to="/privacy" style={{ color: '#080808', fontWeight: '600', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                    {t('cookies.privacyLink')}
                  </Link>
                </p>

                {/* Cookie table */}
                <div style={{ border: '1px solid #e8e6e0', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 14px', background: '#F5F4F0', borderBottom: '1px solid #e8e6e0' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('cookies.table.type')}</span>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('cookies.table.status')}</span>
                  </div>
                  {[
                    { label: t('cookies.types.necessary.label'), desc: t('cookies.types.necessary.desc'), required: true },
                    { label: t('cookies.types.functional.label'), desc: t('cookies.types.functional.desc'), required: true },
                    { label: t('cookies.types.analytics.label'), desc: t('cookies.types.analytics.desc'), required: false },
                  ].map((row, i) => (
                    <div key={row.label} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto',
                      padding: '11px 14px', alignItems: 'center',
                      borderBottom: i < 2 ? '1px solid #f0ede8' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#080808' }}>{row.label}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>{row.desc}</div>
                      </div>
                      <span style={{
                        fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: '2px',
                        background: row.required ? 'rgba(8,8,8,0.07)' : 'rgba(8,8,8,0.04)',
                        color: row.required ? '#444' : '#999',
                        border: `1px solid ${row.required ? '#d0cec8' : '#e8e6e0'}`,
                      }}>
                        {row.required ? t('cookies.labels.required') : t('cookies.labels.optional')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={acceptAll} style={{
                    background: '#080808', color: '#F5F4F0',
                    border: 'none', borderRadius: '3px',
                    padding: '14px', fontSize: '14px', fontWeight: '700',
                    cursor: 'pointer', width: '100%', letterSpacing: '-0.01em',
                  }}>
                    {t('cookies.buttons.acceptAll')}
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={rejectAll} style={{
                      flex: 1, background: 'transparent', color: '#555',
                      border: '1.5px solid #ddd', borderRadius: '3px',
                      padding: '11px', fontSize: '13px', cursor: 'pointer',
                      letterSpacing: '-0.01em',
                    }}>
                      {t('cookies.buttons.declineOptional')}
                    </button>
                    <button onClick={() => setExpanded(true)} style={{
                      flex: 1, background: 'transparent', color: '#080808',
                      border: '1.5px solid #b8b6b0', borderRadius: '3px',
                      padding: '11px', fontSize: '13px', fontWeight: '600',
                      cursor: 'pointer', letterSpacing: '-0.01em',
                    }}>
                      {t('cookies.buttons.managePreferences')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Preferences header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {t('cookies.preferences.header')}
                  </div>
                  <button onClick={() => setExpanded(false)} style={{
                    background: 'none', border: 'none', fontSize: '20px',
                    color: '#aaa', cursor: 'pointer', lineHeight: 1, padding: '0 2px',
                  }}>←</button>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#080808', letterSpacing: '-0.03em', marginBottom: '20px' }}>
                  {t('cookies.preferences.title')}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid #e8e6e0', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px' }}>
                  {[
                    { label: t('cookies.types.necessary.label'), desc: t('cookies.types.necessary.desc'), checked: true, disabled: true, onChange: undefined },
                    { label: t('cookies.types.functional.label'), desc: t('cookies.types.functional.desc'), checked: functional, disabled: false, onChange: setFunctional },
                    { label: t('cookies.types.analytics.label'), desc: t('cookies.types.analytics.desc'), checked: analytics, disabled: false, onChange: setAnalytics },
                  ].map((row, i) => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: '16px', padding: '16px',
                      borderBottom: i < 2 ? '1px solid #f0ede8' : 'none',
                      background: row.disabled ? '#fafaf8' : '#fff',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#080808' }}>{row.label}</span>
                          {row.disabled && (
                            <span style={{
                              fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                              background: 'rgba(8,8,8,0.07)', color: '#666',
                              padding: '2px 6px', borderRadius: '2px', border: '1px solid #d0cec8',
                            }}>{t('cookies.labels.alwaysOn')}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>{row.desc}</div>
                      </div>
                      <Toggle checked={row.checked} onChange={row.onChange} disabled={row.disabled} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={rejectAll} style={{
                    flex: 1, background: 'transparent', color: '#555',
                    border: '1.5px solid #ddd', borderRadius: '3px',
                    padding: '11px', fontSize: '13px', cursor: 'pointer',
                  }}>
                    {t('cookies.buttons.declineOptional')}
                  </button>
                  <button onClick={saveCustom} style={{
                    flex: 1, background: '#080808', color: '#F5F4F0',
                    border: 'none', borderRadius: '3px',
                    padding: '11px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  }}>
                    {t('cookies.buttons.savePreferences')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px',
        background: checked ? '#080808' : '#ddd',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-pressed={checked}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: checked ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}
