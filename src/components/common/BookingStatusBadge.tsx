// src/components/common/BookingStatusBadge.tsx

// Тип для статуса бронирования, строго по списку из AGENTS.md
type StatusType = 'pending_approval' | 'pending_payment' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'disputed' | 'rejected' | 'expired' | 'payment_expired';

interface BookingStatusBadgeProps {
  status: StatusType;
}

// Словарь французских переводов и цветов
const statusConfig: Record<StatusType, { label: string; color: string }> = {
  pending_approval: { label: 'En attente d\'approbation', color: 'orange' },
  pending_payment: { label: 'En attente de paiement', color: 'orange' },
  confirmed: { label: 'Confirmé', color: 'green' },
  active: { label: 'Actif', color: 'blue' },
  completed: { label: 'Terminé', color: 'gray' },
  cancelled: { label: 'Annulé', color: 'red' },
  disputed: { label: 'Contesté', color: 'purple' },
  rejected: { label: 'Rejeté', color: 'red' },
  expired: { label: 'Expiré', color: 'gray' },
  payment_expired: { label: 'Paiement expiré', color: 'gray' },
};

const BookingStatusBadge: React.FC<BookingStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  if (!config) {
    // Fallback на общий стиль, если статус не найден
    return <span className="tag tag-gray">{status}</span>;
  }

  const { label, color } = config;

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