import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { statusLabelKey } from '../domain/catalog'
import CategoryIcon from '../components/icons/CategoryIcon'
import BookingOwnerActions from '../components/booking/BookingOwnerActions'

// Собственные карты убраны в src/domain/catalog.ts. Здесь было две беды:
// категории `tools` и `other`, которых в продукте нет вовсе, и вторая карта
// подписей статусов — она разошлась с бейджем (Actif/En cours,
// Rejeté/Refusé), и одна бронь называлась по-разному на соседних экранах.

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
  const { t } = useTranslation()
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'all'>('active')
  const [actionError, setActionError] = useState('')
  // Ошибка ЗАГРУЗКИ списка, отдельно от ошибки действия. Раньше её не
  // было вовсе: `catch (err) { console.error(err) }` — и владелец,
  // у которого список не загрузился, видел «у вас нет инструментов».
  // Пустой список и сломанный список выглядели одинаково.
  const [loadError, setLoadError] = useState('')

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
      setLoadError('')
    } catch (err) {
      // Техническое — в консоль, человеку — объяснение и путь дальше.
      // Молчание здесь опаснее ошибки: владелец решает, что его
      // объявления пропали, и уходит.
      console.error(err)
      setLoadError(t('loadFailed'))
    }
    finally { setLoading(false) }
  }

  const toggleAvailable = async (id: string, current: boolean) => {
    setActionError('')
    const { error } = await supabase.from('items').update({ available: !current }).eq('id', id)
    if (error) { setActionError(error.message); return }
    setItems(p => p.map(i => i.id === id ? { ...i, available: !current } : i))
  }

  // Ответ на заявку и переходы брони живут в BookingOwnerActions —
  // одном компоненте на /my-items и /my-rentals. Здесь остаётся только
  // применить пришедший статус к локальному списку: страница держит
  // объявления в useState, а не в react-query, поэтому инвалидация
  // ключей из хуков её сама не обновит.
  const applyBookingStatus = (itemId: string, bookingId: string, newStatus: string) => {
    setItems(p => p.map(item => item.id === itemId ? {
      ...item,
      bookings: item.bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b),
    } : item))
  }

  const deleteItem = async (id: string) => {
    if (!confirm(t('myItems.deleteConfirm'))) return
    setActionError('')
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) { setActionError(error.message); return }
    setItems(p => p.filter(i => i.id !== id))
  }

  const filtered = tab === 'active' ? items.filter(i => i.available) : items

  if (loading) return <div className="page"><div className="loading">{t('common.loading')}</div></div>

  return (
    <div className="page">
      {actionError && <div className="error-msg" style={{ marginBottom: '16px' }}>{actionError}</div>}

      {/* Сбой загрузки — с объяснением и кнопкой, а не пустым списком. */}
      {loadError && (
        <div className="error-msg" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{loadError}</span>
          <button
            className="btn btn-secondary btn-sm"
            style={{ minHeight: '40px' }}
            onClick={() => { setLoading(true); fetchItems() }}
          >
            {t('retry')}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>{t('myItems.title')}</h1>
        <Link to="/list-item" className="btn btn-primary">{t('myItems.newListing')}</Link>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>{t('myItems.activeTab')}</button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>{t('myItems.allTab')}</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <p style={{ color: '#666', marginBottom: '16px' }}>{t('myItems.noItems')}</p>
          <Link to="/list-item" className="btn btn-primary">{t('myItems.listFirst')}</Link>
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
                    <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      <CategoryIcon category={item.category} size={32} />
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
                          {item.available ? t('landing.finalCta') : t('myItems.hidden')}
                        </span>
                        {pendingRequests.length > 0 && (
                          <span className="tag tag-yellow">
                            {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {activeBooking && <span className="tag tag-yellow">{t('myItems.rentalInProgress')}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <Link to={`/item/${item.id}`} className="btn btn-secondary btn-sm">{t('myItems.view')}</Link>
                      <Link to={`/edit-item/${item.id}`} className="btn btn-secondary btn-sm">{t('myItems.edit')}</Link>
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
                      {t('myItems.pendingRequests')}
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
                          <BookingOwnerActions
                            bookingId={booking.id}
                            status={booking.status}
                            onDone={(newStatus) => applyBookingStatus(item.id, booking.id, newStatus)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirmed / active bookings */}
                {item.bookings.filter(b => ['confirmed', 'active', 'pending_payment'].includes(b.status)).length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', fontWeight: '700' }}>{t('myItems.requestsTitle')}</h4>
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
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`tag ${
                              booking.status === 'confirmed' ? 'tag-green' :
                              booking.status === 'active' ? 'tag-yellow' :
                              booking.status === 'pending_payment' ? 'tag-yellow' : 'tag-gray'
                            }`}>
                              {t(statusLabelKey(booking.status) ?? '') || booking.status}
                            </span>
                            {/* Переписка, фотографии передачи и отзыв живут
                                в /my-rentals: здесь их дублировать незачем,
                                а бросать владельца искать свою бронь глазами
                                — тем более. Параметр ?booking= прокручивает
                                страницу к нужной карточке. */}
                            <Link to={`/my-rentals?booking=${booking.id}`} className="btn btn-secondary btn-sm">
                              {t('rental.openConversation')}
                            </Link>
                            <BookingOwnerActions
                              bookingId={booking.id}
                              status={booking.status}
                              onDone={(newStatus) => applyBookingStatus(item.id, booking.id, newStatus)}
                            />
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
