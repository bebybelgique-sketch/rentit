import { useState } from 'react'
import { Link } from 'react-router-dom'
import StateIcon from '../components/icons/StateIcon'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { statusLabelKey } from '../domain/catalog'
import CategoryIcon from '../components/icons/CategoryIcon'
import BookingOwnerActions from '../components/booking/BookingOwnerActions'
import { photosOf } from '../lib/items'
import { useOwnerTasks } from '../hooks/useOwnerTasks'
import { useOwnerItems } from '../hooks/useOwnerItems'
import { useSetItemAvailability } from '../hooks/mutations/useSetItemAvailability'
import { useDeleteItem } from '../hooks/mutations/useDeleteItem'
import { usePageTitle } from '../hooks/usePageTitle'
import { errorText } from '../lib/errorText'

// Прямых обращений к базе и ручных setQueryData на этой странице больше нет.
//
// До 06.09 «скрыть» и «удалить» звали supabase из компонента и сами правили
// кэш: список «Моих вещей» был согласован ровно настолько, насколько эта
// страница помнила все свои состояния. Заявка, подтверждённая из /my-rentals
// (или вторым владельцем из другой вкладки), не обновляла список здесь: ключ
// этого запроса не инвалидировала ни одна мутация — он и звался-то чужим
// словом (вещи под именем броней). Человек видел устаревшую заявку, пока не
// обновлял страницу руками.
//
// Теперь действия — мутации (useSetItemAvailability, useDeleteItem), статусы
// броней приходят перечитыванием списка после invalidateBookingCaches, а
// отказ живёт в мутации: react-query сбрасывает его сам, когда начинается
// следующее действие, поэтому отдельного setActionError('') больше нет.
export default function MyItems() {
  const { t } = useTranslation()
  usePageTitle(t('myItems.title'))
  const { user } = useAuth()
  const { data: items = [], isLoading: loading, isError } = useOwnerItems(user?.id)
  const setAvailability = useSetItemAvailability()
  const removeItem = useDeleteItem()
  const [tab, setTab] = useState<'active' | 'all'>('active')
  const loadError = isError ? t('loadFailed') : ''
  const failed = setAvailability.error ?? removeItem.error
  const actionError = failed ? errorText(t, failed, 'errors.generic') : ''

  const toggleAvailable = (id: string, current: boolean) => {
    setAvailability.mutate({ id, available: !current })
  }

  const askDeleteItem = (id: string) => {
    if (!confirm(t('myItems.deleteConfirm'))) return
    removeItem.mutate({ id })
  }

  const filtered = tab === 'active' ? items.filter(i => i.available) : items

  // ДЕЛА СЧИТАЕТ ДОМЕН, А НЕ СТРАНИЦА (src/domain/ownerTasks.ts).
  //
  // Здесь этот подсчёт жил своей копией и знал РОВНО ОДИН вид дела —
  // неотвеченную заявку. Передача вещи и приём возврата лежали в
  // /my-rentals под вкладкой, без единого признака срочности, хотя
  // просроченный возврат держит вещь занятой и упирает в занятые даты
  // следующую заявку на неё.
  //
  // Тот же хук считает число в значке навигации. Два определения слова
  // «дело» — это «3» в кружке над списком из двух строк.
  const { tasks: toDo } = useOwnerTasks()

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
        {/* При пустом списке этой кнопки нет.
            Правило продукта из #39: красный — глагол. На пустом экране глагол
            был один, а красных кнопок три, и все вели в /list-item: эта, та же
            в пустом состоянии ниже и круглая на нижней панели. Когда красным
            выделено всё, не выделено ничего.
            Убрана именно ЭТА: пустое состояние предлагает то же действие, но с
            объяснением («Aucun outil pour l'instant»), а здесь надпись голая.
            Когда вещи есть, кнопка возвращается — тогда пустого состояния нет
            и дубля не возникает. */}
        {filtered.length > 0 && (
          <Link to="/list-item" className="btn btn-primary">{t('myItems.newListing')}</Link>
        )}
      </div>

      {/* «À faire maintenant» — ПЕРВЫМ, и плоским списком по всем вещам.
          Так в канве, и довод не про вкус: заявки лежали внутри карточек
          своих вещей, и владелец с пятью вещами и одной заявкой искал её
          глазами по пяти карточкам. Дашборд отвечает на вопрос «что от меня
          сейчас требуется», а не «какие у меня вещи».
          Дубля не возникает: из карточек этот блок убран целиком, в них
          остались только подтверждённые брони. Счётчик-ярлык на карточке
          оставлен — он сводка, а не второе место действия. */}
      {toDo.length > 0 && (
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            {t('myItems.toDoNow')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {toDo.map(({ task, booking, item }) => (
              <div
                key={booking.id}
                style={{
                  background: '#fffbeb',
                  border: `1px solid ${task.urgent ? 'var(--danger)' : '#fde68a'}`,
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                {/* Какая вещь — первой строкой. В плоском списке это
                    единственное, что отличает одну заявку от другой. */}
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '2px' }}>
                  {item.title ?? t('myItems.untitled')}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {booking.renter?.full_name ?? t('rental.unknownUser')}
                  {' · '}
                  {(booking.start_date ?? '')} → {(booking.end_date ?? '')}
                  {' · '}
                  {t('common.days', { count: booking.total_days ?? 0 })}
                  {' · €'}{Number(booking.total_price ?? 0).toFixed(2)}
                </div>

                {booking.request_message && (
                  <div style={{ fontSize: '13px', color: '#555', marginTop: '6px', fontStyle: 'italic' }}>
                    «{booking.request_message}»
                  </div>
                )}

                {/* СРОК — СВОЙ У КАЖДОГО ВИДА ДЕЛА.

                    У заявки он настоящий: планировщик отменяет её через
                    сутки после создания, и арендатору это обещано на
                    странице вещи вслух. До 20.09 обещание было
                    односторонним — владелец срока не видел нигде.

                    У передачи и возврата срока нет, есть ПРОСРОЧКА.
                    Писать «осталось N» там, где ничего не сгорает, было
                    бы выдумкой: никто эту бронь не отменит. */}
                <div style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '8px',
                  color: task.urgent ? 'var(--danger)' : 'var(--muted)',
                  fontWeight: task.urgent ? 700 : 400,
                }}>
                  {task.kind === 'answer' && task.deadline && (
                    task.deadline.state === 'overdue' ? t('myItems.answerOverdue')
                      : task.deadline.state === 'minutes' ? t('myItems.answerMinutes', { count: task.deadline.minutes })
                      : t('myItems.answerHours', { count: task.deadline.hours })
                  )}
                  {task.kind === 'handover' && (
                    task.overdueDays === 0 ? t('myItems.handoverToday')
                      : t('myItems.handoverLate', { count: task.overdueDays })
                  )}
                  {task.kind === 'complete' && (
                    task.overdueDays === 0 ? t('myItems.returnToday')
                      : t('myItems.returnLate', { count: task.overdueDays })
                  )}
                </div>

                <div style={{ marginTop: '10px' }}>
                  <BookingOwnerActions bookingId={booking.id} status={booking.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>{t('myItems.activeTab')}</button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>{t('myItems.allTab')}</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          {/* Был 📦 — тот же разнобой языков, что и на витрине. См. StateIcon.tsx. */}
          <div style={{ color: 'var(--silver-edge)', marginBottom: '16px' }}>
            <StateIcon name="box" size={44} />
          </div>
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
                        {/* Было 'Untitled item' — по-английски, на французском
                            продукте. Гейт вшитого текста английский не ловит
                            НАМЕРЕННО (иначе список утонет в именах классов и
                            значениях CSS), так что этот класс закрывается
                            глазами. */}
                        <h3 style={{ marginBottom: '4px' }}>{item.title ?? t('myItems.untitled')}</h3>
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
                            {t('myItems.requestsCount', { count: pendingRequests.length })}
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
                        {/* Соседние кнопки этого же ряда — «Voir» и «Modifier» —
                            переведены с самого начала, а эти три слова так и
                            остались французскими для всех языков. */}
                        {(item.available ?? false) ? t('myItems.hide') : t('myItems.show')}
                      </button>
                      <button
                        onClick={() => askDeleteItem(item.id)}
                        className="btn btn-sm"
                        style={{ color: 'var(--danger)', border: '1.5px solid var(--danger)', background: 'transparent' }}
                      >
                        {t('myItems.delete')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Заявок, ждущих ответа, здесь больше НЕТ: они собраны
                    наверху, в «À faire maintenant», плоским списком по всем
                    вещам. Держать их и там, и тут значило бы два места для
                    одного действия — ровно то, что чинили на «Mes locations»
                    (две пустоты вместо одной). Ярлык со счётчиком на карточке
                    остался: он сводка, а не второе место действия. */}

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
                              {(booking.start_date ?? '')} → {(booking.end_date ?? '')} · {t('common.days', { count: booking.total_days ?? 0 })} · €{Number(booking.total_price ?? 0).toFixed(2)}
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
                            <BookingOwnerActions bookingId={booking.id} status={booking.status} />
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
