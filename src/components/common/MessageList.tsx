// src/components/common/MessageList.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import MessageBubble from './MessageBubble';

export interface MessageListItem {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string | null;
}

interface MessageListProps {
  messages: MessageListItem[];
  currentUserId: string;
  emptyLabel?: string;
}

const MessageList: React.FC<MessageListProps> = ({
  messages, currentUserId, emptyLabel,
}) => {
  const { t } = useTranslation();
  if (messages.length === 0) {
    return <p style={{ fontSize: '13px', color: '#666' }}>{emptyLabel ?? t('booking.messagesEmpty')}</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {messages.map((m) => (
        <li key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
          <MessageBubble
            body={m.body}
            createdAt={m.createdAt}
            mine={m.senderId === currentUserId}
            senderName={m.senderName}
          />
        </li>
      ))}
    </ul>
  );
};

export default MessageList;
