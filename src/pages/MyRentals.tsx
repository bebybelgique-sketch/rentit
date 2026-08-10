// src/pages/MyRentals.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRentals } from '../hooks/useRentals';
import BookingStatusBadge from '../components/common/BookingStatusBadge';
import EmptyState from '../components/common/EmptyState';
import { useRentalsAsOwner } from '../hooks/useRentalsAsOwner';
import { useApproveRental } from '../hooks/mutations/useApproveRental';
import { useRejectRental } from '../hooks/mutations/useRejectRental';
// Импортируем toast
import toast from 'react-hot-toast';

const MyRentals: React.FC = () => {
  const { user } = useAuth();

  // Получаем аренды, где пользователь - арендатор
  const { data: userRentals, isLoading: userRentalsLoading, error: userRentalsError } = useRentals(user?.id);

  // Получаем аренды, где пользователь - владелец
  const { data: ownerRentals, isLoading: ownerRentalsLoading, error: ownerRentalsError } = useRentalsAsOwner(user?.id);

  // Инициализируем мутации
  const approveRentalMutation = useApproveRental();
  const rejectRentalMutation = useRejectRental();

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

  if (!user) {
    return (
      <div className="page">
        <div className="loading">Se connecter pour voir vos locations</div>
      </div>
    );
  }

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
              {userRentals.map(rental => (
                <div key={rental.id} className="card" style={{ padding: '16px', marginBottom: '12px' }}>
                  <p><strong>Article:</strong> {rental.item?.title || 'N/A'}</p>
                  <p><strong>Dates:</strong> Du {rental.start_date} au {rental.end_date}</p>
                  <p><strong>Statut :</strong> <BookingStatusBadge status={rental.status} /></p>
                  {/* Добавьте больше деталей аренды по мере необходимости */}
                </div>
              ))}
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
                  <p><strong>Locataire:</strong> {rental.renter_id}</p> {/* Требуется получение профиля пользователя */}
                  <p><strong>Article:</strong> {rental.item?.title || 'N/A'}</p>
                  <p><strong>Dates:</strong> Du {rental.start_date} au {rental.end_date}</p>
                  <p><strong>Statut :</strong> <BookingStatusBadge status={rental.status} /></p>
                  <p><strong>Message:</strong> {rental.message}</p>
                  {/* Кнопки Принять/Отклонить с интеграцией мутаций и улучшенным UX */}
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
                  {/* Отображение ошибки мутации для конкретной аренды, если есть */}
                  {(approveRentalMutation.isError || rejectRentalMutation.isError) && (
                     <p style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                       {(approveRentalMutation.isError && approveRentalMutation.variables?.bookingId === rental.id ? approveRentalMutation.error.message :
                         rejectRentalMutation.isError && rejectRentalMutation.variables?.bookingId === rental.id ? rejectRentalMutation.error.message : '')}
                     </p>
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