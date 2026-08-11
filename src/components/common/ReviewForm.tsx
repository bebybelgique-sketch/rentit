// src/components/common/ReviewForm.tsx
import React, { useState } from 'react';
import RatingStars from './RatingStars';

interface ReviewFormProps {
  title?: string;
  submitLabel?: string;
  commentPlaceholder?: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (review: { rating: number; comment: string }) => void;
  onCancel?: () => void;
}

const MAX_COMMENT = 1000;

const ReviewForm: React.FC<ReviewFormProps> = ({
  title = 'Laisser un avis',
  submitLabel = 'Envoyer',
  commentPlaceholder = 'Votre commentaire (facultatif)',
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Без оценки отправлять нечего: комментарий без числа не считается ни в
  // одном рейтинге и просто потеряется.
  const canSubmit = rating > 0 && !submitting;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit({ rating, comment: comment.trim() }); }}
    >
      <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: '#666', marginBottom: '10px' }}>
        {title}
      </h4>

      <div style={{ marginBottom: '8px' }}>
        <RatingStars value={rating} interactive onChange={setRating} ariaLabel="Votre note" />
      </div>

      <textarea
        value={comment}
        maxLength={MAX_COMMENT}
        placeholder={commentPlaceholder}
        onChange={(e) => setComment(e.target.value)}
        style={{
          width: '100%', minHeight: '60px', padding: '8px 10px',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          marginBottom: '8px', fontFamily: 'inherit', fontSize: '14px',
        }}
      />

      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '8px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!canSubmit}>
          {submitting ? '...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={submitting}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
};

export default ReviewForm;
