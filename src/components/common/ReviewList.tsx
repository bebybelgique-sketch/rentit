// src/components/common/ReviewList.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import RatingStars from './RatingStars';

export interface ReviewListItem {
  id: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface ReviewListProps {
  reviews: ReviewListItem[];
  emptyLabel?: string;
}

// Дата форматируется по языку читателя, а не жёстко по 'fr-BE': «15 août»
// в английском интерфейсе — тот же французский хвост, что и подписи.
const formatDate = (iso: string, locale: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

const ReviewList: React.FC<ReviewListProps> = ({ reviews, emptyLabel }) => {
  const { t, i18n } = useTranslation();

  if (reviews.length === 0) {
    return <p style={{ fontSize: '13px', color: '#666' }}>{emptyLabel ?? t('review.empty')}</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {reviews.map((r) => (
        <li key={r.id} style={{ display: 'flex', gap: '10px' }}>
          {r.authorAvatarUrl ? (
            <img
              src={r.authorAvatarUrl}
              alt=""
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: '#ede9ff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#6d28d9',
              }}
            >
              {r.authorName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '14px' }}>{r.authorName}</strong>
              <RatingStars value={r.rating} size="sm" ariaLabel={t('review.ratingOf', { name: r.authorName })} />
              <time dateTime={r.createdAt} style={{ fontSize: '12px', color: '#999' }}>
                {formatDate(r.createdAt, i18n.language)}
              </time>
            </div>
            {r.comment && (
              <p style={{ fontSize: '14px', marginTop: '2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {r.comment}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ReviewList;
