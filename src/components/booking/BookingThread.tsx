// src/components/booking/BookingThread.tsx
//
// Всё, что происходит вокруг одной брони после того, как стороны нашли друг
// друга: переписка, фотографии при передаче и возврате, взаимный отзыв.
//
// Контейнер знает про данные и права; как это выглядит — знают компоненты
// в components/common. Разделение держится ради того, чтобы правило «кто
// что вправе» жило в одном месте, а не размазывалось по разметке.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MessageList from '../common/MessageList';
import MessageComposer from '../common/MessageComposer';
import PhotoGrid from '../common/PhotoGrid';
import ReviewForm from '../common/ReviewForm';
import { useBookingMessages } from '../../hooks/useBookingMessages';
import { useSendMessage } from '../../hooks/mutations/useSendMessage';
import { useBookingPhotos, type BookingPhotoPhase } from '../../hooks/useBookingPhotos';
import { useUploadBookingPhoto } from '../../hooks/mutations/useUploadBookingPhoto';
import { useCreateUserReview } from '../../hooks/mutations/useCreateUserReview';

interface BookingThreadProps {
  bookingId: string;
  itemId: string;
  currentUserId: string;
  counterpartyId: string;
  counterpartyName: string;
  status: string;
  // Роль смотрящего: определяет, отзыв какого типа он вправе оставить.
  role: 'renter' | 'owner';
}

const box: React.CSSProperties = {
  marginTop: '16px',
  borderTop: '1px solid var(--border)',
  paddingTop: '16px',
};

const heading: React.CSSProperties = {
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 700,
  color: '#666',
  marginBottom: '10px',
};

// Фотографии имеют смысл, пока вещь в пути: до передачи фиксировать нечего,
// после закрытия сделки состояние уже не изменить.
const PHOTO_PHASES: Record<string, BookingPhotoPhase> = {
  confirmed: 'handover',
  active: 'return',
};

// Переписка закрывается вместе со сделкой: писать в отменённую бронь
// некуда — вторая сторона туда больше не заходит.
const CLOSED_STATUSES = ['cancelled', 'rejected', 'expired', 'payment_expired'];

const BookingThread: React.FC<BookingThreadProps> = ({
  bookingId, itemId, currentUserId, counterpartyId, counterpartyName, status, role,
}) => {
  const { t } = useTranslation();
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: messages, isLoading: messagesLoading } = useBookingMessages(bookingId);
  const { data: photos } = useBookingPhotos(bookingId);
  const sendMessage = useSendMessage();
  const uploadPhoto = useUploadBookingPhoto();
  const createReview = useCreateUserReview();

  const photoPhase = PHOTO_PHASES[status];
  const canReview = status === 'completed';
  // Арендатор оценивает владельца, владелец — арендатора. Тип обязан
  // соответствовать стороне: политика в базе отвергнет любое иное сочетание.
  const reviewType = role === 'renter' ? 'owner' : 'renter';

  const handleSend = async (body: string) => {
    setLocalError(null);
    try {
      await sendMessage.mutateAsync({ bookingId, senderId: currentUserId, body });
    } catch (err: any) {
      setLocalError(err.message || t('booking.messageSendFailed'));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoPhase) return;
    setLocalError(null);
    try {
      await uploadPhoto.mutateAsync({
        bookingId, uploadedBy: currentUserId, phase: photoPhase, file,
      });
    } catch (err: any) {
      setLocalError(err.message || t('booking.photoUploadFailed'));
    } finally {
      // Иначе тот же файл повторно не выбирается: браузер не считает это
      // изменением значения поля.
      e.target.value = '';
    }
  };

  const handleReview = async ({ rating, comment }: { rating: number; comment: string }) => {
    setLocalError(null);
    await createReview.mutateAsync({
      bookingId, itemId, fromUserId: currentUserId, toUserId: counterpartyId,
      reviewType, rating, comment,
    });
  };

  const photoItems = (photos || []).map((p) => ({
    id: p.id,
    url: p.url,
    phase: p.phase,
    uploadedAt: p.created_at,
    canRemove: false,
  }));

  return (
    <div>
      {localError && (
        <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '8px' }}>{localError}</p>
      )}

      <div style={box}>
        <h4 style={heading}>{t('booking.messagesTitle')}</h4>
        {messagesLoading ? (
          <p style={{ fontSize: '13px', color: '#666' }}>{t('booking.messagesLoading')}</p>
        ) : (
          <MessageList
            messages={(messages || []).map((m) => ({
              id: m.id,
              body: m.body,
              createdAt: m.created_at,
              senderId: m.sender_id,
              senderName: m.senderName,
            }))}
            currentUserId={currentUserId}
            emptyLabel={t('booking.messagesEmpty')}
          />
        )}

        <MessageComposer
          onSend={handleSend}
          sending={sendMessage.isPending}
          disabled={CLOSED_STATUSES.includes(status)}
        />
      </div>

      {(photoPhase || photoItems.length > 0) && (
        <div style={box}>
          <h4 style={heading}>
            {photoPhase === 'handover'
              ? t('booking.photosTitleHandover')
              : photoPhase === 'return'
                ? t('booking.photosTitleReturn')
                : t('booking.photosTitle')}
          </h4>

          <PhotoGrid
            photos={photoItems}
            emptyLabel={t('booking.photosEmpty')}
          />

          {photoPhase && (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleUpload}
              disabled={uploadPhoto.isPending}
              style={{ fontSize: '13px', marginTop: '10px' }}
            />
          )}
        </div>
      )}

      {canReview && (
        <div style={box}>
          {createReview.isSuccess ? (
            <p style={{ fontSize: '13px', color: '#16a34a' }}>
              {t('booking.reviewThanks')}
            </p>
          ) : (
            <ReviewForm
              title={t('booking.reviewTitle', { name: counterpartyName })}
              submitLabel={t('booking.reviewSubmit')}
              submitting={createReview.isPending}
              error={createReview.isError ? createReview.error.message : null}
              onSubmit={handleReview}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default BookingThread;
