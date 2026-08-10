import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password must be at least 8 characters')
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/profile')
  }

  if (!ready) {
    return (
      <div className="page">
        <div style={{ maxWidth: '420px', margin: '40px auto', textAlign: 'center' }}>
          <div className="loading">Verifying reset link...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div style={{ maxWidth: '420px', margin: '40px auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '24px', fontWeight: '800', textAlign: 'center' }}>New password</h1>
        <div className="card">
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New password (min 8 chars)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
