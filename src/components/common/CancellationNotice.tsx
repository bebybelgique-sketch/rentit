// src/components/common/CancellationNotice.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CancellationNoticeProps {
  cancelledByName: string;
  cancelledAt: string;
  reason: string | null;
  noReasonLabel?: string;
}

const dateFmt = new Intl.DateTimeFormat('fr-BE', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
};

// Отмена без имени и причины оставляет вторую сторону в догадках — а именно
// это и превращает несостоявшуюся сделку в обиду. Поэтому оба поля видимы,
// и отсутствие причины названо прямо, а не спрятано.
const CancellationNotice: React.FC<CancellationNoticeProps> = ({
  cancelledByName, cancelledAt, reason, noReasonLabel,
}) => {
  const { t } = useTranslation();
  const defaultNoReasonLabel = noReasonLabel || t('cancellationNotice.noReason');
  return (
  <div
    style={{
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
      padding: '10px 12px', marginTop: '8px',
    }}
  >
    <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>
      Annulée par {cancelledByName}
      {' — '}
      <time dateTime={cancelledAt} style={{ fontWeight: 400 }}>{formatDate(cancelledAt)}</time>
    </div>
    <div style={{ fontSize: '13px', color: '#7f1d1d', marginTop: '2px', whiteSpace: 'pre-wrap' }}>
      {reason?.trim() ? reason : defaultNoReasonLabel}
    </div>
  </div>
  );
};

export default CancellationNotice;
