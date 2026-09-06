// src/components/common/BookingStatusBadge.tsx

import { useTranslation } from 'react-i18next';
import { statusLabelKey, statusTone } from '../../domain/catalog';
import type { BookingStatusValue } from '../../types';

type StatusType = BookingStatusValue;

interface BookingStatusBadgeProps {
  status: StatusType;
}

// Собственного словаря подписей здесь больше нет. Он был вторым — рядом жила
// карта в MyItems, и они разошлись: «Actif» против «En cours», «Rejeté»
// против «Refusé». Одна бронь называлась по-разному на соседних экранах.
// Подписи теперь в словарях, состав и цвет — в src/domain/catalog.ts, а сам
// набор значений — в схеме: BookingStatusValue объявлен ровно один раз, в
// src/types, выводом из Enums['booking_status'].

const BookingStatusBadge: React.FC<BookingStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation();
  const labelKey = statusLabelKey(status);
  const tone = statusTone(status);
  if (!labelKey || !tone) {
    // Неизвестный статус показываем как есть: выдуманная подпись хуже кода.
    return <span className="tag tag-gray">{status}</span>;
  }

  const label = t(labelKey) || status;
  const color = tone;

  // Используем встроенные стили или определяем классы в CSS
  // Здесь использую встроенные стили для демонстрации, можно заменить на className
  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '2px',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    backgroundColor: color,
    color: 'white',
  };

  return <span style={badgeStyle}>{label}</span>;
};

export default BookingStatusBadge;