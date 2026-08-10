import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { t } from '../i18n'

const CATEGORY_EMOJI: Record<string, string> = {
  power_tools: '🔌', hand_tools: '🔧', garden: '🌿',
  construction: '🏗️', cleaning: '🧹', measuring: '📐',
}

const CATEGORY_FR: Record<string, string> = {
  power_tools: '⚡ Électroportatif', hand_tools: '🔧 Outillage manuel',
  garden: '🌿 Jardinage', construction: '🏗️ Construction',
  cleaning: '🧹 Nettoyage', measuring: '📐 Mesure & Détection',
}

const CONDITION_FR: Record<string, string> = {
  new: 'Neuf', like_new: 'Comme neuf', good: 'Bon état', fair: 'Correct',
}

const INSURANCE_PER_DAY = 0 // Free during beta (will become €3 after 50 transactions)

interface Item {
  id: string
  owner_id: string
  title: string
  description: string | null
  category: string
  condition: string
  price_per_day: number
  deposit: number
  photos: string[]
  lat: number | null
  lng: number | null
  address: string | null
  available: boolean
  users: {
    id: string
    full_name: string
    avatar_url: string | null
    phone: string | null
    phone_verified: boolean
    rating_as_owner: number | null
    is_pro: boolean
  } | null
}

interface BookedRange { start_date: string; end_date: string }

function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function fromISO(s: string) { return new Date(s + 'T00:00:00') }

function isBooked(date: Date, ranges: BookedRange[]) {
  const ds = toISO(date)
  return ranges.some(r => ds >= r.start_date && ds <= r.end_date)
}

export default function ItemDetail() {
  const { id: itemId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()

  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [shared, setShared] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }
  })

  const [requestMessage, setRequestMessage] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [error, setError] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  const [reviews, setReviews] = useState<any[]>([])
  const [canReview, setCanReview] = useState(false)
  const [reviewStars, setReviewStars] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => { if (itemId) fetchItem() }, [itemId])

  const fetchItem = async () => {
    try {
      const [{ data: itemData }, { data: bookedData }, { data: reviewData }] = await Promise.all([
        supabase
          .from('items')
          .select('*, users!owner_id(id, full_name, avatar_url, phone, phone_verified, rating_as_owner, is_pro)')
          .eq('id', itemId!)
          .single(),
        supabase.rpc('get_booked_dates', { p_item_id: itemId }).then(r => ({ data: r.data ?? [], error: r.error })),
        supabase
          .from('reviews')
          .select('*, users!from_user_id(full_name, avatar_url)')
          .eq('item_id', itemId!)
          .eq('review_type', 'item')
          .order('created_at', { ascending: false }),
      ])
      if (itemData) setItem(itemData as unknown as Item)
      setBookedRanges(bookedData || [])
      setReviews(reviewData || [])
      if (user && itemData) checkCanReview(itemData.id, itemData.owner_id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const checkCanReview = async (iId: string, ownerId: string) => {
    if (!user || user.id === ownerId) return
    const [{ data: booking }, { data: existing }] = await Promise.all([
      supabase.from('bookings').select('id').eq('item_id', iId).eq('renter_id', user.id).eq('status', 'completed').maybeSingle(),
      supabase.from('reviews').select('id').eq('item_id', iId).eq('from_user_id', user.id).eq('review_type', 'item').maybeSingle(),
    ])
    setCanReview(!!booking && !existing)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: item?.title || 'RentIt', url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      setShared(true); setTimeout(() => setShared(false), 2000)
    }
  }

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const handleDayClick = (day: number) => {
    const d = new Date(calMonth.year, calMonth.month, day)
    if (d < new Date(new Date().toDateString())) return
    if (isBooked(d, bookedRanges)) return
    const ds = toISO(d)
    if (!startDate || (startDate && endDate)) {
      setStartDate(ds); setEndDate('')
    } else if (ds < startDate) {
      setStartDate(ds); setEndDate('')
    } else {
      let cur = fromISO(startDate)
      let hasConflict = false
      while (toISO(cur) <= ds) {
        if (isBooked(cur, bookedRanges)) { hasConflict = true; break }
        cur = addDays(cur, 1)
      }
      if (!hasConflict) setEndDate(ds)
      else { setStartDate(ds); setEndDate('') }
    }
  }

  const totalDays = startDate && endDate
    ? Math.round((fromISO(endDate).getTime() - fromISO(startDate).getTime()) / 86400000) + 1
    : 0

  const insuranceFee = totalDays > 0 ? INSURANCE_PER_DAY * totalDays : 0
  const totalPrice = totalDays > 0 && item
    ? item.price_per_day * totalDays + item.deposit + insuranceFee
    : 0

  const handleRequest = async () => {
    if (!user || !item || !startDate || !endDate) return
    try {
      setRequestLoading(true); setError('')
      const res = await supabase.functions.invoke('request-rental', {
        body: { item_id: item.id, start_date: startDate, end_date: endDate, message: requestMessage.trim() || null },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })
      if (res.error) throw res.error
      setRequestSent(true)
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi de la demande")
    } finally {
      setRequestLoading(false)
    }
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !item) return
    setReviewLoading(true)
    try {
      const { data: booking } = await supabase
        .from('bookings').select('id').eq('item_id', item.id).eq('renter_id', user.id)
        .eq('status', 'completed').maybeSingle()
      if (!booking) return
      const { error } = await supabase.from('reviews').insert([{
        booking_id: booking.id,
        from_user_id: user.id,
        to_user_id: item.owner_id,
        item_id: item.id,
        review_type: 'item',
        rating: reviewStars,
        comment: reviewComment.trim() || null,
      }])
      if (error) throw error
      setReviewSuccess(true); setCanReview(false)
      fetchItem()
    } catch (err) {
      console.error(err)
    } finally {
      setReviewLoading(false)
    }
  }

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>
  if (!item) return <div className="page"><div className="loading">Outil introuvable</div></div>

  const photos = item.photos || []
  const { year, month } = calMonth
  const daysCount = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null

  return (
    <div className="page">
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', color: 'var(--text)', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
          >
            ← Retour
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleShare}
              style={{ background: 'none', color: 'var(--text)', fontSize: '13px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s' }}
            >
              {shared ? '✓ Copié !' : '↑ Partager'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `📦 ${item.title} — €${item.price_per_day}/jour sur RentIt\n${window.location.href}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: '#25D366', color: '#fff',
                fontSize: '13px', fontWeight: '600',
                border: 'none', borderRadius: 'var(--radius)',
                padding: '6px 12px', textDecoration: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Partager
            </a>
          </div>
        </div>

        {/* Photos */}
        <div className="card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden' }}>
          {photos.length > 0 ? (
            <>
              <img
                src={photos[photoIdx]}
                alt={item.title}
                style={{ width: '100%', height: '340px', objectFit: 'cover' }}
              />
              {photos.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', padding: '12px', overflowX: 'auto' }}>
                  {photos.map((p, i) => (
                    <img
                      key={i} src={p} alt=""
                      onClick={() => setPhotoIdx(i)}
                      style={{
                        width: '64px', height: '64px', objectFit: 'cover',
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                        border: i === photoIdx ? '2px solid #080808' : '2px solid transparent',
                        opacity: i === photoIdx ? 1 : 0.55,
                        transition: 'opacity 0.15s',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '72px', background: 'var(--bg)' }}>
              {CATEGORY_EMOJI[item.category] || '📦'}
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.025em', marginBottom: '10px' }}>{item.title}</h1>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className="tag tag-gray">{CATEGORY_FR[item.category] || item.category}</span>
                <span className="tag tag-gray">{CONDITION_FR[item.condition] || item.condition}</span>
                {!item.available && <span className="tag tag-red">Indisponible</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', lineHeight: 1 }}>
                €{item.price_per_day.toFixed(2)}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>par jour</div>
              {item.deposit > 0 && (
                <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  + €{item.deposit.toFixed(2)} caution
                </div>
              )}
            </div>
          </div>

          {item.description && (
            <p style={{ color: '#555', lineHeight: '1.7', marginBottom: '16px', fontSize: '15px' }}>{item.description}</p>
          )}

          {item.address && (
            <div style={{ color: 'var(--muted)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>📍 {item.address}</div>
          )}
        </div>

        {/* Owner */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '14px' }}>
            {t('ownerLabel')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {item.users?.avatar_url ? (
              <img src={item.users.avatar_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#F2F0EB', fontWeight: '700', flexShrink: 0 }}>
                {item.users?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                {item.users?.full_name}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {item.users?.phone_verified && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: '#e8f5e9', color: '#2e7d32',
                    fontSize: '11px', fontWeight: '600',
                    padding: '3px 8px', borderRadius: '3px',
                    fontFamily: 'var(--font-mono)',
                  }}>{t('phoneVerified')}</span>
                )}
              </div>
              {item.users?.rating_as_owner ? (
                <div className="rating" style={{ fontSize: '13px' }}>★ {Number(item.users.rating_as_owner).toFixed(1)}</div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{t('newOwner')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Booking calendar */}
        {user?.id !== item.owner_id && item.available && (
          <div className="card" style={{ marginBottom: '20px' }}>
            {error && <div className="error-msg">{error}</div>}

            {requestSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <h3 style={{ fontWeight: '800', marginBottom: '8px' }}>Demande envoyée !</h3>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                  Le propriétaire a 24 heures pour répondre. Vous serez notifié par email.
                </p>
                <a href="/my-rentals" className="btn btn-secondary" style={{ fontSize: '14px' }}>
                  Voir mes locations →
                </a>
              </div>
            ) : (
              <>
                {/* === PRIMARY: WhatsApp CTA === */}
                {item.users?.phone ? (
                  <a
                    href={`https://wa.me/${item.users.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Bonjour ! Je suis intéressé(e) par votre "${item.title}" sur RentIt.\nEst-il disponible ? Voici l'annonce : ${window.location.href}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      supabase.from('events').insert({
                        type: 'whatsapp_click',
                        item_id: item.id,
                        user_id: user?.id || null,
                      }).then(() => {})
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      width: '100%', minHeight: '52px',
                      background: '#25D366', color: '#fff',
                      borderRadius: 'var(--radius)', fontWeight: '700', fontSize: '16px',
                      textDecoration: 'none', marginBottom: '10px',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Contacter via WhatsApp
                  </a>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    Contacter via la réservation ci-dessous
                  </div>
                )}

                {/* Separator */}
                {item.users?.phone && user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>ou réserver et payer en ligne</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>
                )}

                {/* === SECONDARY: Calendar + Stripe (только залогиненным) === */}
                {user ? (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                      {t('selectDates')}
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
                      {t('selectDatesHint')}
                    </p>

                    {/* Calendar nav */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <button
                        onClick={() => setCalMonth(p => {
                          const d = new Date(p.year, p.month - 1)
                          return { year: d.getFullYear(), month: d.getMonth() }
                        })}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer', fontSize: '16px' }}
                      >
                        ‹
                      </button>
                      <strong style={{ fontWeight: '700', fontSize: '14px' }}>{monthLabel}</strong>
                      <button
                        onClick={() => setCalMonth(p => {
                          const d = new Date(p.year, p.month + 1)
                          return { year: d.getFullYear(), month: d.getMonth() }
                        })}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer', fontSize: '16px' }}
                      >
                        ›
                      </button>
                    </div>

                    <div className="cal" style={{ marginBottom: '16px' }}>
                      {['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'].map(d => (
                        <div key={d} className="cal-header">{d}</div>
                      ))}
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysCount }).map((_, i) => {
                        const day = i + 1
                        const d = new Date(year, month, day)
                        const ds = toISO(d)
                        const past = d < new Date(new Date().toDateString())
                        const booked = isBooked(d, bookedRanges)
                        const isStart = ds === startDate
                        const isEnd = ds === endDate
                        const inRange = startDate && endDate && ds >= startDate && ds <= endDate
                        const isToday = ds === toISO(new Date())
                        return (
                          <div
                            key={day}
                            className={`cal-day ${booked || past ? 'booked' : 'available'}${isToday ? ' today' : ''}`}
                            style={{
                              background: isStart || isEnd ? '#080808' : inRange ? 'rgba(173,255,47,0.15)' : booked ? '#fde8ea' : past ? '#f5f5f5' : undefined,
                              color: isStart || isEnd ? '#F2F0EB' : booked ? 'var(--danger)' : past ? '#ccc' : undefined,
                              cursor: past || booked ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => !past && !booked && handleDayClick(day)}
                          >
                            {day}
                          </div>
                        )
                      })}
                    </div>

                    {startDate && (
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                        <div><span style={{ color: 'var(--muted)' }}>Du </span>{startDate}</div>
                        {endDate && <div><span style={{ color: 'var(--muted)' }}>Au </span>{endDate}</div>}
                        {totalDays > 0 && <div style={{ fontWeight: '700' }}>{totalDays} jour{totalDays > 1 ? 's' : ''}</div>}
                      </div>
                    )}

                    {totalDays > 0 && (
                      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', fontSize: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--muted)' }}>€{item.price_per_day.toFixed(2)} × {totalDays} jour{totalDays > 1 ? 's' : ''}</span>
                          <span>€{(item.price_per_day * totalDays).toFixed(2)}</span>
                        </div>
                        {item.deposit > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--muted)' }}>Caution (remboursable)</span>
                            <span>€{item.deposit.toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '20px', letterSpacing: '-0.03em', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                          <span>Total estimé</span>
                          <span>€{totalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {totalDays > 0 && (
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--muted)' }}>Message au propriétaire (facultatif)</label>
                        <textarea
                          value={requestMessage}
                          onChange={e => setRequestMessage(e.target.value)}
                          placeholder="Expliquez brièvement votre usage prévu..."
                          rows={2}
                          maxLength={300}
                          style={{ marginTop: '6px', fontSize: '14px' }}
                        />
                      </div>
                    )}

                    <button
                      onClick={handleRequest}
                      disabled={!startDate || !endDate || requestLoading}
                      className="btn btn-primary"
                      style={{ width: '100%', minHeight: '44px', fontSize: '15px' }}
                    >
                      {requestLoading ? 'Envoi en cours...' : !startDate || !endDate ? 'Choisissez les dates pour continuer' : 'Envoyer une demande de réservation'}
                    </button>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: '8px' }}>
                      Aucun paiement maintenant — vous paierez après approbation du propriétaire
                    </p>
                  </>
                ) : (
                  <a href="/login" className="btn btn-secondary" style={{ width: '100%', display: 'block', textAlign: 'center', minHeight: '44px' }}>
                    {t('loginToBook')}
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {user?.id === item.owner_id && (
          <div className="card" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>{t('yourListing')} — </span>
            <a href="/my-items" style={{ fontWeight: '700', textDecoration: 'underline' }}>{t('manageIt')}</a>
          </div>
        )}

        {!item.available && user?.id !== item.owner_id && (
          <div className="card" style={{ marginBottom: '20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            Cet outil est actuellement indisponible
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
              Avis
            </p>
            {avgRating && (
              <div className="rating" style={{ marginBottom: '16px' }}>
                ★ {avgRating.toFixed(1)}
                <span style={{ color: 'var(--muted)', fontWeight: '400', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                  {' '}({reviews.length} avis)
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.map(r => (
                <div key={r.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '14px' }}>{(r.users as any)?.full_name || 'Anonyme'}</strong>
                    <span className="rating" style={{ fontSize: '13px' }}>{'★'.repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.6 }}>{r.comment}</p>}
                  <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canReview && (
          <div className="card">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
              Laisser un avis
            </p>
            {reviewSuccess ? (
              <div className="success-msg">Merci pour votre avis !</div>
            ) : (
              <form onSubmit={handleReviewSubmit}>
                <div className="form-group">
                  <label>Note</label>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setReviewStars(n)}
                        style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', color: n <= reviewStars ? 'var(--warning)' : '#ddd', padding: '0 2px', transition: 'color 0.15s' }}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Commentaire (facultatif)</label>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Partagez votre expérience..." rows={3} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={reviewLoading} style={{ minHeight: '44px' }}>
                  {reviewLoading ? 'Envoi en cours...' : "Envoyer l'avis"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
