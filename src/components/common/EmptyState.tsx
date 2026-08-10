// src/components/common/EmptyState.tsx
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionLabel, actionTo }) => {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{title}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>{description}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn-primary">
          {actionLabel}
        </Link>
      )}
    </div>
  );
};

export default EmptyState;