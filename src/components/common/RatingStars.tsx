// src/components/common/RatingStars.tsx
import React from 'react';

interface RatingStarsProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (value: number) => void;
  ariaLabel?: string;
}

const SIZES: Record<'sm' | 'md' | 'lg', number> = { sm: 14, md: 20, lg: 28 };

const starLabel = (n: number) => (n === 1 ? '1 étoile' : `${n} étoiles`);

// Две разные вещи под одним именем: набор кнопок, когда оценку ставят, и
// одна картинка с подписью, когда её показывают. Показ не должен попадать
// в обход клавиатурой — там нечего нажимать.
const RatingStars: React.FC<RatingStarsProps> = ({
  value, max = 5, size = 'md', interactive = false, onChange, ariaLabel = 'Note',
}) => {
  const px = SIZES[size];
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  if (!interactive) {
    return (
      <span
        role="img"
        aria-label={`${ariaLabel} : ${value.toLocaleString('fr-BE')} sur ${max}`}
        style={{ display: 'inline-flex', gap: '2px', lineHeight: 1 }}
      >
        {stars.map((n) => (
          <span
            key={n}
            aria-hidden="true"
            style={{ fontSize: `${px}px`, color: n <= Math.round(value) ? '#f59e0b' : '#d4d4d8' }}
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <span role="group" aria-label={ariaLabel} style={{ display: 'inline-flex', gap: '2px' }}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={starLabel(n)}
          aria-pressed={n === value}
          onClick={() => onChange?.(n)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
            fontSize: `${px}px`, lineHeight: 1, color: n <= value ? '#f59e0b' : '#d4d4d8',
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
};

export default RatingStars;
