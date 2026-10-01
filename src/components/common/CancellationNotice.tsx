// src/components/common/CancellationNotice.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CancellationNoticeProps {
  /** Кто отменил — «vous» или имя второй стороны. Не нужно, если закрыл таймер. */
  cancelledByName?: string;
  /**
   * Бронь закрыл планировщик (cancelled_by пуст): срок прошёл, передачу
   * никто не отметил. Людей среди отменивших нет — и приписывать отмену
   * второй стороне нельзя: до 01.10 каждая сторона читала «Annulée par
   * <имя другой>», хотя не отменял никто.
   */
  automatic?: boolean;
  cancelledAt: string;
  reason: string | null;
  noReasonLabel?: string;
}

// Дата — по языку читателя, а не жёстко по 'fr-BE' (как в ReviewList):
// «11 août» в нидерландском интерфейсе — тот же французский хвост.
const formatDate = (iso: string, locale: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
};

// Отмена без имени и причины оставляет вторую сторону в догадках — а именно
// это и превращает несостоявшуюся сделку в обиду. Поэтому оба поля видимы,
// и отсутствие причины названо прямо, а не спрятано.
const CancellationNotice: React.FC<CancellationNoticeProps> = ({
  cancelledByName, automatic = false, cancelledAt, reason, noReasonLabel,
}) => {
  const { t, i18n } = useTranslation();
  const defaultNoReasonLabel = noReasonLabel || t('cancellationNotice.noReason');
  // Причину автозакрытия сервер пишет одной французской фразой для всех
  // языков; её смысл известен заранее, поэтому текст берётся из словаря.
  const shownReason = automatic
    ? t('cancellationNotice.automaticReason')
    : reason?.trim() ? reason : defaultNoReasonLabel;
  return (
  <div
    style={{
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
      padding: '10px 12px', marginTop: '8px',
    }}
  >
    <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>
      {automatic ? t('cancellationNotice.automatic') : t('cancellationNotice.by', { name: cancelledByName })}
      {' — '}
      <time dateTime={cancelledAt} style={{ fontWeight: 400 }}>{formatDate(cancelledAt, i18n.language)}</time>
    </div>
    <div style={{ fontSize: '13px', color: '#7f1d1d', marginTop: '2px', whiteSpace: 'pre-wrap' }}>
      {shownReason}
    </div>
  </div>
  );
};

export default CancellationNotice;
