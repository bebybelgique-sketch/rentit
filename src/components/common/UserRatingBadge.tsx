// src/components/common/UserRatingBadge.tsx
import React from 'react';
import RatingStars from './RatingStars';

interface UserRatingBadgeProps {
  rating: number | null;
  count?: number;
  role: 'owner' | 'renter';
  noRatingLabel?: string;
}

const ROLE_LABEL: Record<'owner' | 'renter', string> = {
  owner: 'en tant que propriétaire',
  renter: 'en tant que locataire',
};

// null — это «его ещё никто не оценивал», а не «оценили на ноль». Разница
// принципиальная: новичок с нулём выглядит хуже плохого арендатора.
const UserRatingBadge: React.FC<UserRatingBadgeProps> = ({
  rating, count, role, noRatingLabel = "Pas encore d'avis",
}) => {
  const roleLabel = ROLE_LABEL[role];

  if (rating === null) {
    return (
      <span style={{ fontSize: '13px', color: '#666' }}>
        {noRatingLabel} <span style={{ color: '#999' }}>({roleLabel})</span>
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
      <RatingStars value={rating} size="sm" ariaLabel={`Note ${roleLabel}`} />
      <strong>{rating.toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong>
      {typeof count === 'number' && (
        <span style={{ color: '#666' }}>({count} avis)</span>
      )}
      <span style={{ color: '#999' }}>{roleLabel}</span>
    </span>
  );
};

export default UserRatingBadge;
