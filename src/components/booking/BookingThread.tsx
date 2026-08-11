// src/components/booking/BookingThread.tsx
//
// Всё, что происходит вокруг одной брони после того, как стороны нашли друг
// друга: переписка, фотографии при передаче и возврате, взаимный отзыв.
//
// Разметка здесь намеренно минимальная. Презентационные компоненты
// (MessageList, MessageComposer, PhotoGrid, ReviewForm) строит Qwen отдельным
// треком по контракту пропсов из брифа от 11.08. Когда они появятся, меняется
// разметка внутри этих блоков — состав данных, права и порядок вызовов
// остаются. Ждать их, не давая работать циклу, было бы хуже: цикл и есть
// критерий готовности.
import React, { useState } from 'react';
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

const BookingThread: React.FC<BookingThreadProps> = ({
  bookingId, itemId, currentUserId, counterpartyId, counterpartyName, status, role,
}) => {
  const [draft, setDraft] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
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

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setLocalError(null);
    try {
      await sendMessage.mutateAsync({ bookingId, senderId: currentUserId, body });
      setDraft('');
    } catch (err: any) {
      setLocalError(err.message || "Le message n'a pas pu être envoyé");
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
      setLocalError(err.message || "La photo n'a pas pu être envoyée");
    } finally {
      // Иначе тот же файл повторно не выбирается: браузер не считает это
      // изменением значения поля.
      e.target.value = '';
    }
  };

  const handleReview = async () => {
    setLocalError(null);
    try {
      await createReview.mutateAsync({
        bookingId, itemId, fromUserId: currentUserId, toUserId: counterpartyId,
        reviewType, rating, comment,
      });
      setRating(0);
      setComment('');
    } catch (err: any) {
      setLocalError(err.message || "L'avis n'a pas pu être enregistré");
    }
  };

  return (
    <div>
      {localError && (
        <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '8px' }}>{localError}</p>
      )}

      <div style={box}>
        <h4 style={heading}>Messages</h4>
        {messagesLoading && <p style={{ fontSize: '13px', color: '#666' }}>Chargement...</p>}
        {!messagesLoading && messages && messages.length === 0 && (
          <p style={{ fontSize: '13px', color: '#666' }}>
            Aucun message. Convenez ici du lieu et de l'heure.
          </p>
        )}
        {messages && messages.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((m) => (
              <li
                key={m.id}
                style={{
                  alignSelf: m.sender_id === currentUserId ? 'flex-end' : 'flex-start',
                  background: m.sender_id === currentUserId ? '#ede9ff' : '#f4f4f5',
                  borderRadius: '10px', padding: '8px 12px', maxWidth: '80%',
                }}
              >
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                  {m.sender_id === currentUserId ? 'Vous' : m.senderName}
                </div>
                <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{m.body}</div>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={draft}
            maxLength={2000}
            placeholder="Votre message"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSend}
            disabled={sendMessage.isPending || !draft.trim()}
          >
            {sendMessage.isPending ? '...' : 'Envoyer'}
          </button>
        </div>
      </div>

      {(photoPhase || (photos && photos.length > 0)) && (
        <div style={box}>
          <h4 style={heading}>
            État de l'outil
            {photoPhase === 'handover' && ' — à la remise'}
            {photoPhase === 'return' && ' — au retour'}
          </h4>

          {photos && photos.length > 0 ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {photos.map((p) => (
                <img
                  key={p.id}
                  src={p.url}
                  alt={p.phase === 'handover' ? "État à la remise" : 'État au retour'}
                  style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '8px' }}
                />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              Aucune photo. Photographier l'outil protège les deux parties.
            </p>
          )}

          {photoPhase && (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleUpload}
              disabled={uploadPhoto.isPending}
              style={{ fontSize: '13px' }}
            />
          )}
        </div>
      )}

      {canReview && (
        <div style={box}>
          <h4 style={heading}>
            Votre avis sur {counterpartyName}
          </h4>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={n === 1 ? '1 étoile' : `${n} étoiles`}
                onClick={() => setRating(n)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '20px', lineHeight: 1, padding: 0,
                  color: n <= rating ? '#f59e0b' : '#d4d4d8',
                }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            maxLength={1000}
            placeholder="Votre commentaire (facultatif)"
            onChange={(e) => setComment(e.target.value)}
            style={{ width: '100%', minHeight: '60px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '8px' }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleReview}
            disabled={rating === 0 || createReview.isPending}
          >
            {createReview.isPending ? '...' : "Envoyer l'avis"}
          </button>
          {createReview.isSuccess && (
            <p style={{ fontSize: '13px', color: 'var(--success, #16a34a)', marginTop: '6px' }}>
              Merci, votre avis est enregistré.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingThread;
