import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { statusLabelKey, isBookingStatus } from '../domain/catalog'
import CategoryIcon from '../components/icons/CategoryIcon'
import BookingOwnerActions from '../components/booking/BookingOwnerActions'
import { photosOf } from '../lib/items'
import { useOwnerItems, type OwnerItem } from '../hooks/useOwnerItems'

export default function MyItems() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: items = [], isLoading: loading, isError } = useOwnerItems(user?.id)
  const [tab, setTab] = useState<'active' | 'all'>('active')
  const [actionError, setActionError] = useState('')
  const loadError = isError ? t('loadFailed') : ''

  const toggleAvailable = async (id: string, current: boolean) => {
    setActionError('')
    const { error } = await supabase.from('items').update({ available: !current }).eq('id', id)
    if (error) { setActionError(error.message); return }

    queryClient.setQueryData<OwnerItem[]>(['bookings', user?.id], (currentItems) => {
      if (!currentItems) return currentItems
      return currentItems.map(item => item.id === id ? { ...item, available: !current } : item)
    })
  }

  const applyBookingStatus = (itemId: string, bookingId: string, newStatus: string) => {
    if (!isBookingStatus(newStatus)) {
      console.warn('Неизвестный статус брони от сервера:', newStatus)
      return
    }

    queryClient.setQueryData<OwnerItem[]>(['bookings', user?.id], (currentItems) => {
      if (!currentItems) return currentItems
      return currentItems.map(item => item.id === itemId ? {
        ...item,
        bookings: item.bookings.map(booking => booking.id === bookingId ? { ...booking, status: newStatus } : booking),
      } : item)
    })
  }

  const deleteItem = async (id: string) => {
    if (!confirm(t('myItems.deleteConfirm'))) return
    setActionError('')
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) { setActionError(error.message); return }

    queryClient.setQueryData<OwnerItem[]>(['bookings', user?.id], (currentItems) => {
      if (!currentItems) return currentItems
      return currentItems.filter(item => item.id !== id)
    })
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
            const itemPhotos = photosOf(item)
            const pendingRequests = item.bookings.filter(b => b.status === 'pending_approval')
            const activeBooking = item.bookings.find(b => b.status === 'active')
            return (
              <div key={item.id} className="card">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                  {itemPhotos[0] ? (
                   <img src={itemPhotos[0]} alt={item.title ?? 'Item'} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                     <CategoryIcon category={item.category ?? ''} size={32} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h3 style={{ marginBottom: '4px' }}>{item.title ?? 'Untitled item'}</h3>
                        <div style={{ color: '#999', fontSize: '13px' }}>
                          €{item.price_per_day ?? 0}/jour
                          {(item.deposit ?? 0) > 0 && ` · €${item.deposit ?? 0} caution`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className={`tag ${(item.available ?? false) ? 'tag-green' : 'tag-gray'}`}>
                          {(item.available ?? false) ? t('landing.finalCta') : t('myItems.hidden')}
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
                        onClick={() => toggleAvailable(item.id, item.available ?? false)}
                        className="btn btn-secondary btn-sm"
                      >
                        {(item.available ?? false) ? 'Masquer' : 'Afficher'}
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
                                {booking.renter?.full_name ?? 'Utilisateur'}
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                                {(booking.start_date ?? '')} → {(booking.end_date ?? '')} · {(booking.total_days ?? 0)} jour{(booking.total_days ?? 0) !== 1 ? 's' : ''} · €{Number(booking.total_price ?? 0).toFixed(2)}
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
                            status={booking.status ?? 'pending_approval'}
                            onDone={(newStatus) => applyBookingStatus(item.id, booking.id, newStatus)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirmed / active bookings */}
                {item.bookings.filter(b => ['confirmed', 'active', 'pending_payment'].includes(b.status ?? '')).length > 0 && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', fontWeight: '700' }}>{t('myItems.requestsTitle')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {item.bookings.filter(b => ['confirmed', 'active', 'pending_payment'].includes(b.status ?? '')).map(booking => (
                        <div key={booking.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9ff', padding: '10px 14px', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px' }}>
                              {booking.renter?.full_name ?? 'Utilisateur'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666' }}>
                              {(booking.start_date ?? '')} → {(booking.end_date ?? '')} · {(booking.total_days ?? 0)} jour{(booking.total_days ?? 0) !== 1 ? 's' : ''} · €{Number(booking.total_price ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`tag ${
                              (booking.status ?? '') === 'confirmed' ? 'tag-green' :
                              (booking.status ?? '') === 'active' ? 'tag-yellow' :
                              (booking.status ?? '') === 'pending_payment' ? 'tag-yellow' : 'tag-gray'
                            }`}>
                              {t(statusLabelKey(booking.status ?? 'pending_approval') ?? '') || (booking.status ?? 'pending_approval')}
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
                              status={booking.status ?? 'pending_approval'}
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
