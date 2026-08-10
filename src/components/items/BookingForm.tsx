// src/components/items/BookingForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCreateRental } from '../../hooks/mutations/useCreateRental';
import { Item } from '../../types';

interface BookingFormProps {
  item: Item;
  onBookingSuccess?: () => void; // Колбэк для уведомления родителя об успешной отправке
}

const BookingForm: React.FC<BookingFormProps> = ({ item, onBookingSuccess }) => {
  const { user } = useAuth();
  const createRentalMutation = useCreateRental();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requestMessage, setRequestMessage] = useState(''); // Состояние для сообщения

  const totalDays = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
    : 0;

  const insuranceFee = totalDays > 0 ? 0 : 0; // INSURANCE_PER_DAY, можно вынести в конфиг
  const totalPrice = totalDays > 0
    ? item.price_per_day * totalDays + (item.deposit || 0) + insuranceFee
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !startDate || !endDate) return;

    // Цену считает сервер (edge-функция request-rental), а арендатора он берёт
    // из токена — поэтому total_price и renter_id с клиента не отправляем:
    // на цифру с клиента всё равно никто не смотрит, а видимость обратного
    // опаснее её отсутствия. totalPrice ниже показывается пользователю как
    // предварительная оценка.
    const rentalData = {
      item_id: item.id,
      start_date: startDate,
      end_date: endDate,
      message: requestMessage.trim(),
    };

    try {
      // Вызов мутации для создания аренды
      await createRentalMutation.mutateAsync(rentalData);
      if (onBookingSuccess) {
        onBookingSuccess(); // Уведомляем родителя
      }
      // Сброс формы после успешной отправки
      setStartDate('');
      setEndDate('');
      setRequestMessage('');
    } catch (error: any) {
      // Здесь можно обработать ошибку, например, показать сообщение
      console.error("Ошибка бронирования:", error);
      // alert(error.message || "Произошла ошибка при отправке запроса");
      // Вместо alert лучше использовать toast.error, если он доступен в контексте
    }
  };

  if (!user) {
    return (
      <a href="/login" className="btn btn-secondary" style={{ width: '100%', display: 'block', textAlign: 'center', minHeight: '44px' }}>
        Se connecter pour réserver
      </a>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {createRentalMutation.isError && (
        <div className="error-msg">
          {(createRentalMutation.error as Error).message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
        <div>
          <label htmlFor="startDate">Du</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label htmlFor="endDate">Au</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {totalDays > 0 && (
        <>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: 'var(--muted)' }}>Message au propriétaire (facultatif)</label>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Expliquez brièvement votre usage prévu..."
              rows={2}
              maxLength={300}
              style={{ marginTop: '6px', fontSize: '14px' }}
            />
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--muted)' }}>€{item.price_per_day.toFixed(2)} × {totalDays} jour{totalDays > 1 ? 's' : ''}</span>
              <span>€{(item.price_per_day * totalDays).toFixed(2)}</span>
            </div>
            {item.deposit && item.deposit > 0 && (
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

          <button
            type="submit"
            disabled={createRentalMutation.isPending || !startDate || !endDate}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '44px', fontSize: '15px' }}
          >
            {createRentalMutation.isPending ? 'Envoi en cours...' : 'Réserver maintenant'}
          </button>
        </>
      )}
    </form>
  );
};

export default BookingForm;