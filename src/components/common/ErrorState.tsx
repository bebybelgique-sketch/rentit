// src/components/common/ErrorState.tsx
import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--danger)' }}>
      <p style={{ marginBottom: '16px' }}>{message}</p>
      {onRetry && (
        // Здесь стояло английское «Retry» — на французском продукте, у
        // голландца и у француза одинаково. Ключ `retry` («Réessayer») в
        // словарях был всё это время; слово просто не завернули.
        <button onClick={onRetry} className="btn btn-secondary">
          {t('retry')}
        </button>
      )}
    </div>
  );
};

export default ErrorState;