// src/components/common/ErrorState.tsx
import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  /** Внутри раздела страницы (переписка, фото, форма), а не вместо неё. */
  compact?: boolean;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, compact = false }) => {
  const { t } = useTranslation();

  return (
    // role="alert": сбой чтения объявляется и программе чтения экрана —
    // иначе незрячий человек услышит только пустоту на месте раздела.
    <div
      role="alert"
      style={compact
        ? { padding: '8px 0', color: 'var(--danger)', fontSize: '13px' }
        : { textAlign: 'center', padding: '40px 20px', color: 'var(--danger)' }}
    >
      <p style={{ marginBottom: compact ? '8px' : '16px' }}>{message}</p>
      {onRetry && (
        // Здесь стояло английское «Retry» — на французском продукте, у
        // голландца и у француза одинаково. Ключ `retry` («Réessayer») в
        // словарях был всё это время; слово просто не завернули.
        <button onClick={onRetry} className={compact ? 'btn btn-secondary btn-sm' : 'btn btn-secondary'}>
          {t('retry')}
        </button>
      )}
    </div>
  );
};

export default ErrorState;