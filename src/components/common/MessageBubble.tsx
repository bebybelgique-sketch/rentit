// src/components/common/MessageBubble.tsx
import React from 'react';

interface MessageBubbleProps {
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
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
const MessageBubble: React.FC<MessageBubbleProps> = ({ body, createdAt, mine, senderName }) => (
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
      <span>{mine ? 'Vous' : senderName}</span>
      <time dateTime={createdAt} style={{ color: '#999' }}>{formatTime(createdAt)}</time>
    </div>
    <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</div>
  </div>
);

export default MessageBubble;
