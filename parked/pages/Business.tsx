import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    items: 20,
    features: [
      '0% commission on all rentals',
      'Up to 20 active listings',
      'Business badge on all items',
      'Basic earnings report',
      'Standard search position',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 99,
    items: 100,
    popular: true,
    features: [
      '0% commission on all rentals',
      'Up to 100 active listings',
      'Business badge on all items',
      'Full earnings dashboard',
      'Priority in search results',
      'CSV bulk upload',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 149,
    items: null,
    features: [
      '0% commission on all rentals',
      'Unlimited listings',
      'Business badge on all items',
      'Full earnings dashboard',
      'Top priority in search',
      'CSV bulk upload',
      'Dedicated account manager',
      'Custom invoice (PEPPOL ready)',
    ],
  },
]

export default function Business() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [businessName, setBusinessName] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canceled = searchParams.get('canceled') === '1'

  const handleSubscribe = async (planId: string) => {
    if (!user) { navigate('/login'); return }
    if (!businessName.trim()) { setError('Enter your business name first'); return }
    setError('')
    setSelectedPlan(planId)
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('create-business-checkout', {
        body: { plan: planId, business_name: businessName.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw res.error
      const { url } = res.data as { url: string }
      window.location.href = url
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
      setSelectedPlan(null)
    }
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {canceled && (
          <div className="error-msg" style={{ marginBottom: '24px' }}>
            Checkout canceled — no charge was made.
          </div>
        )}

        {/* Hero */}
        <div style={{ marginBottom: '48px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '12px',
          }}>
            For businesses
          </p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontWeight: '800',
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            marginBottom: '16px',
          }}>
            Own a rental shop?<br />
            <span style={{ color: '#ADFF2F', fontStyle: 'italic' }}>Keep 100%.</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '52ch', lineHeight: 1.6 }}>
            List your entire inventory on RentIt. One flat monthly fee.
            Zero per-rental commission. Every euro yours.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px',
          background: 'var(--border)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          marginBottom: '48px',
        }}>
          {[
            { num: '0%', label: 'Platform commission' },
            { num: '€83+', label: 'Avg. monthly savings' },
            { num: '3×', label: 'More bookings with priority' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--card)', textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '4px' }}>{s.num}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Business name input */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Your business name</label>
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Brussels Tool Rental, Van Den Berg Equipment..."
              style={{ marginTop: '8px' }}
            />
          </div>
          {error && <div className="error-msg" style={{ marginTop: '10px', marginBottom: 0 }}>{error}</div>}
        </div>

        {/* Pricing cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '48px' }}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              style={{
                background: plan.popular ? '#080808' : 'var(--card)',
                border: plan.popular ? '1.5px solid #080808' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '28px 24px',
                position: 'relative',
                transition: 'transform 0.2s',
              }}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)',
                  background: '#ADFF2F', color: '#080808',
                  fontSize: '10px', fontWeight: '700',
                  padding: '3px 14px', borderRadius: '20px', whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Most popular
                </div>
              )}

              <div style={{
                fontWeight: '800', fontSize: '18px', marginBottom: '4px',
                color: plan.popular ? '#F2F0EB' : 'var(--text)',
              }}>
                {plan.name}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '40px', fontWeight: '800', letterSpacing: '-0.04em', lineHeight: 1,
                  color: plan.popular ? '#ADFF2F' : 'var(--text)',
                }}>
                  €{plan.price}
                </span>
                <span style={{
                  color: plan.popular ? 'rgba(242,240,235,0.4)' : 'var(--muted)',
                  fontSize: '14px', fontFamily: 'var(--font-mono)',
                }}>/mo</span>
              </div>

              <div style={{
                color: plan.popular ? 'rgba(242,240,235,0.7)' : 'var(--muted)',
                fontSize: '12px', marginBottom: '20px',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              }}>
                {plan.items ? `Up to ${plan.items} listings` : 'Unlimited listings'}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    fontSize: '13px',
                    color: plan.popular ? 'rgba(242,240,235,0.7)' : '#444',
                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                  }}>
                    <span style={{ color: plan.popular ? '#ADFF2F' : 'var(--text)', fontWeight: '700', flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: plan.popular ? '#ADFF2F' : '#080808',
                  color: plan.popular ? '#080808' : '#F2F0EB',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading && selectedPlan !== plan.id ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '-0.01em',
                  minHeight: '44px',
                }}
              >
                {loading && selectedPlan === plan.id ? 'Redirecting…' : `Start ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--muted)', marginBottom: '24px',
          }}>
            How it works
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
            {[
              { num: '01', title: 'Pick a plan', desc: 'Choose Starter, Growth, or Enterprise based on your inventory size' },
              { num: '02', title: 'Upload inventory', desc: 'Add items manually or use CSV bulk upload (Growth+)' },
              { num: '03', title: 'Get discovered', desc: 'Customers nearby find your tools and book instantly' },
              { num: '04', title: 'Keep 100%', desc: 'No commission. Flat monthly fee. Every euro yours.' },
            ].map(s => (
              <div key={s.num}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', letterSpacing: '0.06em' }}>
                  {s.num}
                </div>
                <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>{s.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--muted)', marginBottom: '16px',
          }}>
            FAQ
          </p>
          {[
            ['Can I cancel anytime?', 'Yes. Cancel from your business dashboard. No lock-in, no exit fees.'],
            ['What happens to my listings if I cancel?', 'They stay visible but switch to 12% commission (free plan).'],
            ['Do renters pay insurance on top?', 'Yes — renters pay €3/day insurance (covers damage up to €500). You are not affected.'],
            ['Can I upgrade later?', 'Yes, upgrade or downgrade your plan at any time from the dashboard.'],
            ['Is there a free trial?', 'Not yet — but break-even on Starter is just €408/month rental income.'],
          ].map(([q, a]) => (
            <div key={q} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>{q}</div>
              <div style={{ color: 'var(--muted)', fontSize: '14px' }}>{a}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
          Already on a business plan?{' '}
          <a href="/business/dashboard" style={{ color: 'var(--text)', fontWeight: '700', textDecoration: 'underline' }}>
            Dashboard →
          </a>
        </div>

      </div>
    </div>
  )
}
