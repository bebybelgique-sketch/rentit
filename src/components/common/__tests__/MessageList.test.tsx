import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageList from '../MessageList';

const messages = [
  { id: '1', body: 'Bonjour', createdAt: '2026-08-11T10:00:00Z', senderId: 'u1', senderName: 'Marie' },
  { id: '2', body: 'A 18h', createdAt: '2026-08-11T10:05:00Z', senderId: 'me', senderName: 'Jean' },
];

describe('MessageList', () => {
  it('пустой список объясняет, что делать', () => {
    render(<MessageList messages={[]} currentUserId="me" emptyLabel="Aucun message" />);
    expect(screen.getByText('Aucun message')).toBeInTheDocument();
  });

  it('своё сообщение подписано «Vous», чужое — именем', () => {
    render(<MessageList messages={messages} currentUserId="me" />);
    expect(screen.getByText('Marie')).toBeInTheDocument();
    expect(screen.getByText('Vous')).toBeInTheDocument();
    expect(screen.queryByText('Jean')).not.toBeInTheDocument();
  });

  it('показывает тела всех сообщений', () => {
    render(<MessageList messages={messages} currentUserId="me" />);
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText('A 18h')).toBeInTheDocument();
  });
});
