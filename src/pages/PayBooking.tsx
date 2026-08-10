import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CheckoutForm from '../components/CheckoutForm'

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

interface BookingInfo {
  id: string
  start_date: string
  end_date: string
  total_days: number
  total_price: number
  deposit_amount: number
  approved_at: string
  status: string
  items: { title: string; photos: string[] }
}

export default function PayBooking() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user && bookingId) init()
  }, [user, bookingId])

  // Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) return
    const interval = setInterval(() => {
      setRemainingSeconds(s => {
        if (s <= 1) { clearInterval(interval); setError('Le délai de paiement a expiré.'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [remainingSeconds])

  const init = async () => {
    try {
      // Fetch booking info for display
      const { data, error: fetchErr } = await supabase
        .from('bookings')
        .select('id, start_date, end_date, total_days, total_price, deposit_amount, approved_at, status, items(title, photos)')
        .eq('id', bookingId!)
        .single()

      if (fetchErr || !data) { setError('Réservation introuvable.'); setLoading(false); return }
      if (data.status === 'confirmed') { navigate('/my-rentals'); return }
      if (!['pending_payment'].includes(data.status)) {
        setError(`Cette réservation n'est plus en attente de paiement (statut : ${data.status}).`)
        setLoading(false)
        return
      }

      setBooking(data as unknown as BookingInfo)

      // Get payment intent (use fetch directly so non-JSON error responses don't crash)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Session expirée, veuillez vous reconnecter.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const piResp = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      const piText = await piResp.text()
      let piJson: any
      try { piJson = JSON.parse(piText) } catch { throw new Error(`Erreur serveur: ${piText}`) }
      if (!piResp.ok) throw new Error(piJson.error || `Erreur ${piResp.status}`)

      const { client_secret, amount: amt, remaining_seconds } = piJson as {
        client_secret: string; amount: number; remaining_seconds: number
      }

      setClientSecret(client_secret)
      setAmount(amt)
      setRemainingSeconds(remaining_seconds)
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du paiement.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!user) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <p>Vous devez être connecté pour accéder à cette page.</p>
      <a href="/login" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>Se connecter</a>
    </div>
  )

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>

  if (success) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
      <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Paiement réussi !</h1>
      <p style={{ color: '#666' }}>Votre réservation est confirmée. Vous allez être redirigé...</p>
    </div>
  )

  return (
    <div className="page">
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/my-rentals')}
          style={{ background: 'none', color: 'var(--text)', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: '24px' }}
        >
          ← Retour
        </button>

        <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '24px' }}>Finaliser le paiement</h1>

        {error ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏱</div>
            <p style={{ color: 'var(--danger)', fontWeight: '600', marginBottom: '16px' }}>{error}</p>
            <a href="/browse" className="btn btn-primary">Parcourir les outils</a>
          </div>
        ) : booking && clientSecret ? (
          <>
            {/* Booking summary */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>
                Résumé de la réservation
              </p>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                {(booking.items as any)?.photos?.[0] ? (
                  <img src={(booking.items as any).photos[0]} alt="" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'var(--bg)', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{(booking.items as any)?.title}</div>
                  <div style={{ color: '#666', fontSize: '13px', marginTop: '2px' }}>
                    {booking.start_date} → {booking.end_date} ({booking.total_days} jour{booking.total_days !== 1 ? 's' : ''})
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--muted)' }}>Location</span>
                  <span>€{Number(booking.total_price).toFixed(2)}</span>
                </div>
                {booking.deposit_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--muted)' }}>Caution (remboursable)</span>
                    <span>€{Number(booking.deposit_amount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '18px', letterSpacing: '-0.02em', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                  <span>Total</span>
                  <span>€{(amount / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Countdown */}
            {remainingSeconds > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: remainingSeconds < 600 ? '#fff3cd' : '#f0f4ff',
                border: `1px solid ${remainingSeconds < 600 ? '#ffc107' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '20px', fontSize: '14px',
              }}>
                <span style={{ fontSize: '18px' }}>⏱</span>
                <span>
                  Temps restant pour payer : <strong>{formatTime(remainingSeconds)}</strong>
                </span>
              </div>
            )}

            {/* Stripe checkout */}
            <div className="card">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '20px' }}>
                Paiement sécurisé
              </p>
              {clientSecret.includes('pi_mock_') ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Mode de test — paiement simulé</p>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <CheckoutForm
                    amount={amount}
                    bookingId={bookingId!}
                    onSuccess={() => { setSuccess(true); setTimeout(() => navigate('/my-rentals'), 2000) }}
                    onCancel={() => navigate('/my-rentals')}
                  />
                </Elements>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
