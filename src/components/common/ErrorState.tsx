// src/components/common/ErrorState.tsx
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--danger)' }}>
      <p style={{ marginBottom: '16px' }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          Retry
        </button>
      )}
    </div>
  );
};

export default ErrorState;