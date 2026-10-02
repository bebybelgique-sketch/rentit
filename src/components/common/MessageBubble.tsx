// src/components/common/MessageBubble.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

interface MessageBubbleProps {
  body: string;
  createdAt: string;
  mine: boolean;
  /** null — имя не названо: подпись «Utilisateur» на языке читателя. */
  senderName: string | null;
}

const timeFmt = new Intl.DateTimeFormat('fr-BE', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : timeFmt.format(d);
};

// Текст выводится как текст. Сообщения пишут незнакомые друг другу люди —
// разметка из чужих рук в разметку страницы попасть не должна. Переносы
// строк сохраняются: адрес в одну строку нечитаем.
const MessageBubble: React.FC<MessageBubbleProps> = ({ body, createdAt, mine, senderName }) => {
  // «Vous» и «Utilisateur» — из словаря: до 02.10 «Vous» стояло над каждым
  // своим сообщением на всех трёх языках, хотя ключ booking.messageMine был.
  const { t } = useTranslation();
  return (
  <div
    style={{
      alignSelf: mine ? 'flex-end' : 'flex-start',
      background: mine ? '#ede9ff' : '#f4f4f5',
      borderRadius: '10px',
      padding: '8px 12px',
      maxWidth: '80%',
    }}
  >
    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px', display: 'flex', gap: '6px' }}>
      <span>{mine ? t('booking.messageMine') : (senderName || t('rental.unknownUser'))}</span>
      <time dateTime={createdAt} style={{ color: '#999' }}>{formatTime(createdAt)}</time>
    </div>
    <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</div>
  </div>
  );
};

export default MessageBubble;
