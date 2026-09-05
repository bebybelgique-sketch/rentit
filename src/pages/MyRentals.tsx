// src/pages/MyRentals.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRentals } from '../hooks/useRentals';
import BookingStatusBadge from '../components/common/BookingStatusBadge';
import EmptyState from '../components/common/EmptyState';
import BookingThread from '../components/booking/BookingThread';
import BookingOwnerActions from '../components/booking/BookingOwnerActions';
import CancellationNotice from '../components/common/CancellationNotice';
import UserRatingBadge from '../components/common/UserRatingBadge';
import { useRentalsAsOwner } from '../hooks/useRentalsAsOwner';
import { useTransitionBooking } from '../hooks/mutations/useTransitionBooking';
import { serverErrorKey } from '../domain/serverErrors';
import type { Rental } from '../types';
// Импортируем toast
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const dateFmt = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' });
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
};

// Отменить можно, пока вещь не уехала. После передачи отменять нечего:
// инструмент физически в чужих руках, и закрывается это возвратом.
const CANCELLABLE_BY_RENTER = ['pending_approval', 'confirmed'];

const MyRentals: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Получаем аренды, где пользователь - арендатор
  const { data: userRentals, isLoading: userRentalsLoading, error: userRentalsError } = useRentals(user?.id);

  // Получаем аренды, где пользователь - владелец
  const { data: ownerRentals, isLoading: ownerRentalsLoading, error: ownerRentalsError } = useRentalsAsOwner(user?.id);

  // Отмена арендатором — единственное действие, которое эта страница
  // делает сама. Всё, что доступно ВЛАДЕЛЬЦУ (одобрить, отклонить,
  // передать, вернуть, отменить), собрано в BookingOwnerActions и живёт
  // одинаково здесь и в /my-items.
  const transitionMutation = useTransitionBooking();

  const handleCancel = async (rentalId: string) => {
    const reason = prompt(t('rental.cancelPrompt'));
    if (reason === null) return;
    try {
      await transitionMutation.mutateAsync({ bookingId: rentalId, action: 'cancel', reason });
      toast.success(t('rental.cancelSuccess'));
    } catch (error: unknown) {
      // 409 от сервера означает, что вторая сторона уже изменила бронь.
      // Показываем причину, а не «успешно»: тихий успех здесь был бы враньём.
      toast.error(t(serverErrorKey(error instanceof Error ? error.message : null)));
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="loading">{t('myRentals.loginRequired')}</div>
      </div>
    );
  }

  const renderCancellation = (rental: Rental, otherPartyName: string) => {
    if (rental.status !== 'cancelled' || !rental.cancelled_at) return null;
    const byMe = rental.cancelled_by === user.id;
    return (
      <CancellationNotice
        cancelledByName={byMe ? t('rental.cancelledByYouShort') : otherPartyName}
        cancelledAt={rental.cancelled_at}
        reason={rental.cancellation_reason ?? null}
      />
    );
  };

  return (
    <div className="page">
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>{t('myRentalsTitle')}</h1>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
          <button
            onClick={() => document.getElementById('as-renter')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          >
            {t('myRentals.asRenter')}
          </button>
          <button
            onClick={() => document.getElementById('as-owner')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          >
            {t('myRentals.requestsForMyTools')}
          </button>
        </div>

        {/* Аренды как арендатор */}
        <section id="as-renter" style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>{t('myRentals.renterTitle')}</h2>
          {userRentalsLoading && <p>{t('common.loading')}</p>}
          {userRentalsError && <p>Erreur: {userRentalsError.message}</p>}
          {userRentals && userRentals.length === 0 && (
            <EmptyState title={t('myRentals.noRentals')} description={t('myRentals.noRentalsHint')} actionLabel={t('myRentals.browseTools')} actionTo="/browse" />
          )}
          {userRentals && userRentals.length > 0 && (
            <div>
              {userRentals.map(rental => {
                const owner = rental.item?.owner;
                return (
                  <div key={rental.id} className="card" style={{ padding: '16px', marginBottom: '12px' }}>
                    <p><strong>{t('rental.labelItem')}:</strong> {rental.item?.title || 'N/A'}</p>
                    <p>
                      <strong>{t('rental.labelOwner')}:</strong> {owner?.full_name || t('rental.unknownUser')}{' '}
                      <UserRatingBadge rating={owner?.rating_as_owner ?? null} role="owner" />
                    </p>
                    <p><strong>{t('rental.labelDates')}:</strong> {t('rental.datesRange', { start: formatDate(rental.start_date), end: formatDate(rental.end_date) })}</p>
                    <p><strong>{t('rental.labelStatus')} :</strong> <BookingStatusBadge status={rental.status} /></p>
                    {/* Доставка показывается из СНИМКА в брони, а не из вещи:
                        владелец мог с тех пор поменять цену, но договорённость
                        была на этой. */}
                    {rental.delivery_requested && rental.delivery_fee != null && (
                      <p><strong>{t('rental.labelDelivery')}:</strong> €{Number(rental.delivery_fee).toFixed(2)} <span style={{ color: 'var(--muted)' }}>{t('rental.deliveryOnSite')}</span></p>
                    )}
                    {renderCancellation(rental, owner?.full_name || "l'autre partie")}

                    {CANCELLABLE_BY_RENTER.includes(rental.status) && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCancel(rental.id)}
                          disabled={transitionMutation.isPending}
                        >
                          {t('rental.cancelButton')}
                        </button>
                      </div>
                    )}

                    {owner && (
                      <BookingThread
                        bookingId={rental.id}
                        itemId={rental.item_id}
                        currentUserId={user.id}
                        counterpartyId={owner.id}
                        counterpartyName={owner.full_name || 'Utilisateur'}
                        status={rental.status}
                        role="renter"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Аренды как владелец */}
        <section id="as-owner" style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>{t('myRentals.ownerTitle')}</h2>
          {ownerRentalsLoading && <p>{t('common.loading')}</p>}
          {ownerRentalsError && <p>Erreur: {ownerRentalsError.message}</p>}
          {ownerRentals && ownerRentals.length === 0 && (
            <EmptyState title={t('myRentals.noRequests')} description={t('myRentals.noRequestsHint')} actionLabel={t('myRentals.listTool')} actionTo="/list-item" />
          )}
          {ownerRentals && ownerRentals.length > 0 && (
            <div>
              {ownerRentals.map(rental => (
                <div key={rental.id} className="card" style={{ padding: '16px', marginBottom: '12px' }}>
                  {/* Здесь стоял rental.renter_id — владелец видел сырой UUID
                      вместо человека, к которому поедет. Профиль приходит
                      вместе с бронью (useRentalsAsOwner). */}
                  <p>
                    <strong>{t('rental.labelRenter')}:</strong> {rental.renter?.full_name || t('rental.unknownUser')}{' '}
                    <UserRatingBadge rating={rental.renter?.rating_as_renter ?? null} role="renter" />
                  </p>
                  <p><strong>{t('rental.labelItem')}:</strong> {rental.item?.title || 'N/A'}</p>
                  <p><strong>{t('rental.labelDates')}:</strong> {t('rental.datesRange', { start: formatDate(rental.start_date), end: formatDate(rental.end_date) })}</p>
                  <p><strong>{t('rental.labelStatus')} :</strong> <BookingStatusBadge status={rental.status} /></p>
                  {/* Поля message в bookings нет: столбец называется
                      request_message, и страница показывала пустоту. */}
                  {rental.delivery_requested && rental.delivery_fee != null && (
                    <p><strong>{t('rental.labelDelivery')}:</strong> €{Number(rental.delivery_fee).toFixed(2)} <span style={{ color: 'var(--muted)' }}>{t('rental.deliveryOnSite')}</span></p>
                  )}
                  {rental.request_message && <p><strong>{t('rental.labelMessage')}:</strong> {rental.request_message}</p>}
                  {renderCancellation(rental, rental.renter?.full_name || "l'autre partie")}

                  {/* Весь путь сделки владельца — от ответа на заявку до
                      возврата — не покидая эту страницу. Раньше здесь
                      кончалось на «Accepter/Refuser», а «передана» и
                      «возвращена» надо было искать в /my-items.

                      Ошибку показывает сам компонент: прежний блок ниже
                      печатал сырое error.message, то есть служебную фразу
                      supabase-js вместо причины отказа. */}
                  <div style={{ marginTop: '8px' }}>
                    <BookingOwnerActions bookingId={rental.id} status={rental.status} />
                  </div>

                  {rental.renter && (
                    <BookingThread
                      bookingId={rental.id}
                      itemId={rental.item_id}
                      currentUserId={user.id}
                      counterpartyId={rental.renter.id}
                      counterpartyName={rental.renter.full_name || 'Utilisateur'}
                      status={rental.status}
                      role="owner"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyRentals;
