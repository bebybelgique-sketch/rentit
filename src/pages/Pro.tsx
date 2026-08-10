import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { label: '0% platform fee', desc: 'Keep 100% of every rental. Free accounts pay 12%.' },
  { label: 'Pro badge', desc: 'Stand out in search — renters trust verified Pro owners.' },
  { label: 'Earnings dashboard', desc: 'Income per item, per month, occupancy rate.' },
  { label: 'Priority listing', desc: 'Your items rank higher in all search results.' },
  { label: 'Early access', desc: 'First to get bulk upload, B2B tools, and analytics.' },
]

const TABLE_ROWS = [
  ['Platform commission', '12%', '0%'],
  ['Insurance coverage',  '✓',   '✓'],
  ['Listings',            'Unlimited', 'Unlimited'],
  ['Pro badge in search', '—',   '✓'],
  ['Earnings dashboard',  '—',   '✓'],
  ['Priority in search',  '—',   '✓'],
  ['Early access',        '—',   '✓'],
]

export default function Pro() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkLoading, setCheckLoading] = useState(true)

  const success  = searchParams.get('success')  === '1'
  const canceled = searchParams.get('canceled') === '1'

  useEffect(() => {
    if (!user) { setCheckLoading(false); return }
    supabase
      .from('users')
      .select('is_pro')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsPro(data?.is_pro === true)
        setCheckLoading(false)
      })
  }, [user])

  const handleSubscribe = async () => {
    if (!user) { navigate('/login'); return }
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('create-pro-checkout', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw res.error
      window.location.href = (res.data as { url: string }).url
    } catch (err: any) {
      alert(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Banners */}
        {success && (
          <div className="success-msg" style={{ marginBottom: '24px' }}>
            ⚡ Welcome to Pro! Your 0% commission is now active.
          </div>
        )}
        {canceled && (
          <div className="error-msg" style={{ marginBottom: '24px' }}>
            Checkout canceled — no charge was made.
          </div>
        )}

        {/* Hero */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '12px',
          }}>
            Pro plan
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: '800', letterSpacing: '-0.035em', lineHeight: 1.05, marginBottom: '16px' }}>
            Stop paying 12%.<br />
            <span style={{ color: '#ADFF2F', fontStyle: 'italic' }}>Keep everything.</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '16px', lineHeight: 1.6, maxWidth: '46ch' }}>
            One flat fee. Zero per-rental commission. Every euro your tools earn stays with you.
          </p>
        </div>

        {/* Pricing card — dark */}
        <div style={{
          background: '#080808',
          borderRadius: 'var(--radius)',
          padding: '32px',
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Accent glow */}
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '180px', height: '180px',
            background: 'radial-gradient(circle, rgba(173,255,47,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(242,240,235,0.7)',
            marginBottom: '16px',
          }}>
            Monthly · Cancel anytime
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '24px' }}>
            <span style={{ fontSize: '56px', fontWeight: '800', letterSpacing: '-0.04em', color: '#F2F0EB', lineHeight: 1 }}>
              €9.99
            </span>
            <span style={{ color: 'rgba(242,240,235,0.4)', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
              / mo
            </span>
          </div>

          {checkLoading ? (
            <div className="skeleton" style={{ height: '48px', width: '100%' }} />
          ) : isPro ? (
            <div style={{
              padding: '14px 20px',
              border: '1px solid rgba(173,255,47,0.3)',
              borderRadius: 'var(--radius)',
              background: 'rgba(173,255,47,0.08)',
              color: '#ADFF2F',
              fontWeight: '700',
              fontSize: '15px',
              textAlign: 'center',
            }}>
              ✓ You are a Pro member
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: '#ADFF2F',
                color: '#080808',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.01em',
              }}
            >
              {loading ? 'Redirecting…' : 'Start Pro — €9.99/mo'}
            </button>
          )}

          {!user && !checkLoading && (
            <p style={{ marginTop: '12px', fontSize: '13px', color: 'rgba(242,240,235,0.7)', textAlign: 'center' }}>
              <a href="/login" style={{ color: '#ADFF2F', fontWeight: '600' }}>Log in</a> to subscribe
            </p>
          )}
        </div>

        {/* Break-even */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          marginBottom: '32px',
          background: '#fff',
        }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '12px',
          }}>
            Break-even calculator
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.7, marginBottom: '12px' }}>
            At <strong style={{ color: 'var(--text)' }}>12% commission</strong>, Pro pays for itself when your monthly rental income exceeds:
          </p>
          <div style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '6px' }}>
            €83<span style={{ fontSize: '18px', color: 'var(--muted)', fontWeight: '400' }}>/month</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            ~6 rentals at €15/day · after that, every euro is yours
          </p>
        </div>

        {/* Features */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '16px',
          }}>
            What's included
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FEATURES.map((f, i) => (
              <div key={f.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '16px 0',
                borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>{f.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{f.desc}</div>
                </div>
                <div style={{ color: '#ADFF2F', fontWeight: '800', fontSize: '16px', flexShrink: 0 }}>✓</div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison table */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '16px',
          }}>
            Free vs Pro
          </p>
          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--muted)', fontWeight: '500', fontSize: '12px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}></th>
                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--muted)', fontWeight: '500', fontSize: '12px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Free</th>
                <th style={{ textAlign: 'center', padding: '8px', color: '#080808', fontWeight: '700', fontSize: '12px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pro ⚡</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map(([label, free, pro]) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 0', color: 'var(--text)', fontSize: '14px' }}>{label}</td>
                  <td style={{ textAlign: 'center', padding: '11px 8px', color: 'var(--muted)', fontSize: '14px' }}>{free}</td>
                  <td style={{ textAlign: 'center', padding: '11px 8px', fontWeight: '700', color: free === pro ? 'var(--muted)' : '#080808', fontSize: '14px' }}>{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom CTA */}
        {!isPro && !checkLoading && (
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="btn btn-accent"
              style={{ fontSize: '15px', padding: '14px 40px', minHeight: '48px' }}
            >
              {loading ? 'Redirecting…' : 'Start Pro — €9.99/mo'}
            </button>
            <p style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '10px', letterSpacing: '0.04em' }}>
              Secured by Stripe · Cancel anytime
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
