import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '420px', margin: '40px auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '24px', fontWeight: '800', textAlign: 'center' }}>Reset password</h1>
        <div className="card">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
              <p style={{ color: '#555', marginBottom: '20px' }}>
                Check your email for a password reset link.
              </p>
              <Link to="/login" className="btn btn-primary">Back to login</Link>
            </div>
          ) : (
            <>
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px' }}>
                <Link to="/login" style={{ color: '#999' }}>Back to login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
