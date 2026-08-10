import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_TAG: Record<string, string> = {
  pending_approval: 'tag-yellow',
  pending_payment: 'tag-yellow',
  confirmed: 'tag-green',
  active: 'tag-yellow',
  completed: 'tag-gray',
  cancelled: 'tag-red',
  rejected: 'tag-red',
  expired: 'tag-gray',
  payment_expired: 'tag-red',
  disputed: 'tag-red',
}

const STATUS_FR: Record<string, string> = {
  pending_approval: 'En attente d\'approbation',
  pending_payment: 'Approuvé — paiement requis',
  confirmed: 'Confirmé',
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  rejected: 'Refusé',
  expired: 'Expiré (pas de réponse)',
  payment_expired: 'Délai de paiement dépassé',
  disputed: 'Litige',
}

interface Booking {
  id: string
  start_date: string
  end_date: string
  total_days: number
  total_price: number
  deposit_amount: number
  deposit_returned: boolean
  status: string
  amount_paid: number | null
  approved_at: string | null
  created_at: string
  request_message: string | null
  items: {
    id: string
    title: string
    photos: string[]
    category: string
    users: { full_name: string; phone: string | null; phone_verified: boolean }
  }
}

export default function MyRentals() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'past'>('active')

  useEffect(() => { if (user) fetchBookings() }, [user])

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, items(id, title, photos, category, users!owner_id(full_name, phone, phone_verified))')
        .eq('renter_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setBookings(data as unknown as Booking[])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const cancelBooking = async (id: string) => {
    if (!confirm('Annuler cette demande ?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    setBookings(p => p.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
  }

  const activeStatuses = ['pending_approval', 'pending_payment', 'confirmed', 'active']
  const filtered = tab === 'active'
    ? bookings.filter(b => activeStatuses.includes(b.status))
    : bookings.filter(b => !activeStatuses.includes(b.status))

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>

  return (
    <div className="page">
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '800' }}>Mes locations</h1>

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>En cours</button>
        <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>Terminées</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <p style={{ color: '#666', marginBottom: '16px' }}>Aucune location pour l'instant</p>
          <Link to="/browse" className="btn btn-primary">Parcourir les outils</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map(booking => {
            const item = booking.items as unknown as Booking['items']
            const owner = (item?.users as any)
            const showPhone = booking.status === 'confirmed' || booking.status === 'active'
            const isPendingPayment = booking.status === 'pending_payment' && booking.approved_at

            return (
              <div key={booking.id} className="card">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                  {item?.photos?.[0] ? (
                    <img src={item.photos[0]} alt="" style={{ width: '72px', height: '72px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '72px', height: '72px', borderRadius: '8px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
                      📦
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <Link to={`/item/${item?.id}`} style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text)' }}>
                          {item?.title}
                        </Link>
                        <div style={{ color: '#666', fontSize: '13px', marginTop: '2px' }}>
                          {booking.start_date} → {booking.end_date} ({booking.total_days} jour{booking.total_days !== 1 ? 's' : ''})
                        </div>
                      </div>
                      <span className={`tag ${STATUS_TAG[booking.status] || 'tag-gray'}`} style={{ whiteSpace: 'nowrap' }}>
                        {STATUS_FR[booking.status] || booking.status}
                      </span>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px' }}>
                      <div>
                        <span style={{ color: '#999' }}>Location : </span>
                        <strong>€{Number(booking.total_price).toFixed(2)}</strong>
                      </div>
                      {booking.deposit_amount > 0 && (
                        <div>
                          <span style={{ color: '#999' }}>Caution : </span>
                          <strong>€{Number(booking.deposit_amount).toFixed(2)}</strong>
                          {booking.deposit_returned && <span className="tag tag-green" style={{ marginLeft: '6px', fontSize: '11px' }}>Remboursée</span>}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                      <span style={{ color: '#999' }}>Propriétaire : </span>
                      <strong>{owner?.full_name}</strong>
                      {owner?.phone_verified && <span className="tag tag-green" style={{ marginLeft: '6px', fontSize: '11px' }}>✓ Vérifié</span>}
                    </div>

                    {owner?.phone && (
                      showPhone
                        ? <div style={{ marginTop: '4px', fontSize: '14px', color: '#555' }}>📞 {owner.phone}</div>
                        : <div style={{ marginTop: '4px', fontSize: '13px', color: '#aaa' }}>📞 Numéro communiqué après confirmation</div>
                    )}

                    {/* Approved — pay now */}
                    {isPendingPayment && (
                      <div style={{ marginTop: '14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
                        <p style={{ fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                          Votre demande a été approuvée !
                        </p>
                        <p style={{ fontSize: '13px', color: '#555', marginBottom: '12px' }}>
                          Finalisez le paiement dans les 2 heures pour confirmer la réservation.
                        </p>
                        <Link to={`/pay/${booking.id}`} className="btn btn-primary" style={{ fontSize: '14px', minHeight: '38px' }}>
                          Payer maintenant →
                        </Link>
                      </div>
                    )}

                    {/* Pending approval info */}
                    {booking.status === 'pending_approval' && (
                      <p style={{ marginTop: '10px', fontSize: '13px', color: '#888', fontFamily: 'var(--font-mono)' }}>
                        En attente de réponse du propriétaire (24h max)
                      </p>
                    )}

                    {/* Cancel button */}
                    {booking.status === 'pending_approval' && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="btn btn-sm"
                        style={{ marginTop: '12px', color: 'var(--danger)', border: '1.5px solid var(--danger)', background: 'transparent' }}
                      >
                        Annuler la demande
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
