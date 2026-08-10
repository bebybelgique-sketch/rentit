import React, { useState } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'

interface Props {
  amount: number   // cents
  bookingId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function CheckoutForm({ amount, onSuccess, onCancel }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true); setError('')

    const { error: submitErr } = await elements.submit()
    if (submitErr) { setError(submitErr.message || 'Payment error'); setLoading(false); return }

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/my-rentals` },
      redirect: 'if_required',
    })

    if (confirmErr) { setError(confirmErr.message || 'Payment failed'); setLoading(false) }
    else onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '20px' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px 16px', background: '#f8f9ff', borderRadius: '8px' }}>
        <span style={{ fontWeight: '600' }}>Total charged</span>
        <span style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)' }}>€{(amount / 100).toFixed(2)}</span>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="submit" disabled={loading || !stripe} className="btn btn-primary" style={{ flex: 1 }}>
          {loading ? 'Processing...' : `Pay €${(amount / 100).toFixed(2)}`}
        </button>
        <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}
