import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const CATEGORY_EMOJI: Record<string, string> = {
  power_tools: '⚡', hand_tools: '🔧', garden: '🌿',
  construction: '🏗️', cleaning: '🧹', measuring: '📐',
  tools: '🔧', other: '📦',
}

const STATUS_FR: Record<string, string> = {
  pending_approval: 'En attente',
  pending_payment: 'Paiement en attente',
  confirmed: 'Confirmé',
  active: 'En cours',
  completed: 'Terminé',
  disputed: 'Litige',
  cancelled: 'Annulé',
  rejected: 'Refusé',
  expired: 'Expiré',
  payment_expired: 'Paiement expiré',
}

interface Booking {
  id: string
  status: string
  start_date: string
  end_date: string
  total_price: number
  total_days: number
  request_message: string | null
  users: { full_name: string }
}

interface Item {
  id: string
  title: string
  category: string
  price_per_day: number
  deposit: number
  photos: string[]
  available: boolean
  created_at: string
  bookings: Booking[]
}

export default function MyItems() {
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'all'>('active')
  const [actionError, setActionError] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)

  useEffect(() => { if (user) fetchItems() }, [user])

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*, bookings(id, status, start_date, end_date, total_price, total_days, request_message, users!renter_id(full_name))')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setItems(data as unknown as Item[])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const toggleAvailable = async (id: string, current: boolean) => {
    setActionError('')
    const { error } = await supabase.from('items').update({ available: !current }).eq('id', id)
    if (error) { setActionError(error.message); return }
    setItems(p => p.map(i => i.id === id ? { ...i, available: !current } : i))
  }

  const respondToRequest = async (bookingId: string, itemId: string, action: 'approve' | 'reject') => {
    setActionError('')
    setRespondingId(bookingId)
    try {
      const res = await supabase.functions.invoke('respond-to-request', {
        body: { booking_id: bookingId, action },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      if (res.error) throw res.error
      // Update local state
      const newStatus = action === 'approve' ? 'pending_payment' : 'rejected'
      setItems(p => p.map(item => item.id === itemId ? {
        ...item,
        bookings: item.bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b),
      } : item))
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de la réponse')
    } finally {
      setRespondingId(null)
    }
  }

  const updateBookingStatus = async (bookingId: string, itemId: string, status: string) => {
    setActionError('')
    const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId)
    if (error) { setActionError(error.message); return }
    setItems(p => p.map(item => item.id === itemId ? {
      ...item,
      bookings: item.bookings.map(b => b.id === bookingId ? { ...b, status } : b),
    } : item))
    supabase.functions.invoke('notify-rental', {
      body: { booking_id: bookingId, event: status },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }).catch(() => {})
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Supprimer cette annonce ? Cette action est irréversible.')) return
    setActionError('')
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) { setActionError(error.message); return }
    setItems(p => p.filter(i => i.id !== id))
  }

  const filtered = tab === 'active' ? items.filter(i => i.available) : items

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>

  return (
    <div className="page">
      {actionError && <div className="error-msg" style={{ marginBottom: '16px' }}>{actionError}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>Mes outils</h1>
        <Link to="/list-item" className="btn btn-primary">+ Nouvelle annonce</Link>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Actifs</button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>Tous</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <p style={{ color: '#666', marginBottom: '16px' }}>Aucun outil pour l'instant</p>
          <Link to="/list-item" className="btn btn-primary">Déposer votre premier outil</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filtered.map(item => {
            const pendingRequests = item.bookings.filter(b => b.status === 'pending_approval')
            const activeBooking = item.bookings.find(b => b.status === 'active')
            return (
              <div key={item.id} className="card">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                  {item.photos?.[0] ? (
                    <img src={item.photos[0]} alt="" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#ede9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', flexShrink: 0 }}>
                      {CATEGORY_EMOJI[item.category]}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h3 style={{ marginBottom: '4px' }}>{item.title}</h3>
                        <div style={{ color: '#999', fontSize: '13px' }}>
                          €{item.price_per_day}/jour
                          {item.deposit > 0 && ` · €${item.deposit} caution`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`tag ${item.available ? 'tag-green' : 'tag-gray'}`}>
                          {item.available ? 'Disponible' : 'Masqué'}
                        </span>
                        {pendingRequests.length > 0 && (
                          <span className="tag tag-yellow">
                            {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {activeBooking && <span className="tag tag-yellow">Location en cours</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <Link to={`/item/${item.id}`} className="btn btn-secondary btn-sm">Voir</Link>
                      <button
                        onClick={() => toggleAvailable(item.id, item.available)}
                        className="btn btn-secondary btn-sm"
                      >
                        {item.available ? 'Masquer' : 'Afficher'}
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="btn btn-sm"
                        style={{ color: 'var(--danger)', border: '1.5px solid var(--danger)', background: 'transparent' }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pending approval requests */}
                {pendingRequests.length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', fontWeight: '700' }}>
                      Demandes en attente
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {pendingRequests.map(booking => (
                        <div key={booking.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '14px' }}>
                                {(booking.users as any)?.full_name}
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                                {booking.start_date} → {booking.end_date} · {booking.total_days} jour{booking.total_days !== 1 ? 's' : ''} · €{Number(booking.total_price).toFixed(2)}
                              </div>
                              {booking.request_message && (
                                <div style={{ fontSize: '13px', color: '#555', marginTop: '6px', fontStyle: 'italic' }}>
                                  "{booking.request_message}"
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => respondToRequest(booking.id, item.id, 'approve')}
                              disabled={respondingId === booking.id}
                              className="btn btn-primary btn-sm"
                            >
                              {respondingId === booking.id ? '...' : 'Approuver'}
                            </button>
                            <button
                              onClick={() => respondToRequest(booking.id, item.id, 'reject')}
                              disabled={respondingId === booking.id}
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)', border: '1.5px solid var(--danger)', background: 'transparent' }}
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirmed / active bookings */}
                {item.bookings.filter(b => ['confirmed', 'active', 'pending_payment'].includes(b.status)).length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', fontWeight: '700' }}>Réservations</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {item.bookings.filter(b => ['confirmed', 'active', 'pending_payment'].includes(b.status)).map(booking => (
                        <div key={booking.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9ff', padding: '10px 14px', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px' }}>
                              {(booking.users as any)?.full_name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666' }}>
                              {booking.start_date} → {booking.end_date} · {booking.total_days} jour{booking.total_days !== 1 ? 's' : ''} · €{Number(booking.total_price).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`tag ${
                              booking.status === 'confirmed' ? 'tag-green' :
                              booking.status === 'active' ? 'tag-yellow' :
                              booking.status === 'pending_payment' ? 'tag-yellow' : 'tag-gray'
                            }`}>
                              {STATUS_FR[booking.status] || booking.status}
                            </span>
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, item.id, 'active')}
                                className="btn btn-primary btn-sm"
                              >
                                Marquer récupéré
                              </button>
                            )}
                            {booking.status === 'active' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, item.id, 'completed')}
                                className="btn btn-primary btn-sm"
                              >
                                Marquer retourné
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
