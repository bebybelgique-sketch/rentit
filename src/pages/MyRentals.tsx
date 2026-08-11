// src/pages/MyRentals.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRentals } from '../hooks/useRentals';
import BookingStatusBadge from '../components/common/BookingStatusBadge';
import EmptyState from '../components/common/EmptyState';
import BookingThread from '../components/booking/BookingThread';
import CancellationNotice from '../components/common/CancellationNotice';
import UserRatingBadge from '../components/common/UserRatingBadge';
import { useRentalsAsOwner } from '../hooks/useRentalsAsOwner';
import { useApproveRental } from '../hooks/mutations/useApproveRental';
import { useRejectRental } from '../hooks/mutations/useRejectRental';
import { useTransitionBooking } from '../hooks/mutations/useTransitionBooking';
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

  // Инициализируем мутации
  const approveRentalMutation = useApproveRental();
  const rejectRentalMutation = useRejectRental();
  const transitionMutation = useTransitionBooking();

  const handleApprove = async (rentalId: string) => {
    if (!user) return;
    try {
      await approveRentalMutation.mutateAsync({ bookingId: rentalId });
      // Уведомления об успехе через toast
      toast.success("La demande a été acceptée !");
    } catch (error: any) {
      console.error("Erreur lors de l'approbation:", error);
      // Уведомления об ошибке через toast
      toast.error(error.message || "Erreur lors de l'approbation");
    }
  };

  const handleReject = async (rentalId: string) => {
    if (!user) return;
    try {
      await rejectRentalMutation.mutateAsync({ bookingId: rentalId });
      // Уведомления об успехе через toast
      toast.success("La demande a été refusée.");
    } catch (error: any) {
      console.error("Erreur lors du rejet:", error);
      // Уведомления об ошибке через toast
      toast.error(error.message || "Erreur lors du rejet");
    }
  };

  const handleCancel = async (rentalId: string) => {
    const reason = prompt(t('rental.cancelPrompt'));
    if (reason === null) return;
    try {
      await transitionMutation.mutateAsync({ bookingId: rentalId, action: 'cancel', reason });
      toast.success(t('rental.cancelSuccess'));
    } catch (error: any) {
      // 409 от сервера означает, что вторая сторона уже изменила бронь.
      // Показываем как есть: тихо «успешно» здесь было бы враньём.
      toast.error(error.message || t('rental.cancelFailed'));
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="loading">Se connecter pour voir vos locations</div>
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
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>Mes Locations</h1>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
          <button
            onClick={() => document.getElementById('as-renter')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          >
            En tant que locataire
          </button>
          <button
            onClick={() => document.getElementById('as-owner')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          >
            Demandes pour mes outils
          </button>
        </div>

        {/* Аренды как арендатор */}
        <section id="as-renter" style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Mes locations (Locataire)</h2>
          {userRentalsLoading && <p>Chargement...</p>}
          {userRentalsError && <p>Erreur: {userRentalsError.message}</p>}
          {userRentals && userRentals.length === 0 && (
            <EmptyState title="Aucune location en cours" description="Vos demandes de location apparaîtront ici." actionLabel="Parcourir les outils" actionTo="/browse" />
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
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Demandes pour mes outils (Propriétaire)</h2>
          {ownerRentalsLoading && <p>Chargement...</p>}
          {ownerRentalsError && <p>Erreur: {ownerRentalsError.message}</p>}
          {ownerRentals && ownerRentals.length === 0 && (
            <EmptyState title="Aucune demande" description="Les demandes de location pour vos outils apparaîtront ici." actionLabel="Déposer une annonce" actionTo="/list-item" />
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
                  {rental.request_message && <p><strong>{t('rental.labelMessage')}:</strong> {rental.request_message}</p>}
                  {renderCancellation(rental, rental.renter?.full_name || "l'autre partie")}

                  {rental.status === 'pending_approval' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => handleApprove(rental.id)}
                        disabled={approveRentalMutation.isPending}
                      >
                        {approveRentalMutation.isPending ? '...' : 'Accepter'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => handleReject(rental.id)}
                        disabled={rejectRentalMutation.isPending}
                      >
                        {rejectRentalMutation.isPending ? '...' : 'Refuser'}
                      </button>
                    </div>
                  )}

                  {/* Отображение ошибки мутации для конкретной аренды, если есть */}
                  {(approveRentalMutation.isError || rejectRentalMutation.isError) && (
                     <p style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                       {(approveRentalMutation.isError && approveRentalMutation.variables?.bookingId === rental.id ? approveRentalMutation.error.message :
                         rejectRentalMutation.isError && rejectRentalMutation.variables?.bookingId === rental.id ? rejectRentalMutation.error.message : '')}
                     </p>
                   )}

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
