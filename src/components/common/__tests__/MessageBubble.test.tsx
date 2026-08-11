import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';

describe('MessageBubble', () => {
  it('своё сообщение подписано «Vous»', () => {
    render(<MessageBubble body="Salut" createdAt="2026-08-11T10:00:00Z" mine senderName="Jean" />);
    expect(screen.getByText('Vous')).toBeInTheDocument();
  });

  // Сообщения пишут незнакомые люди: разметка из чужих рук не должна
  // попадать в разметку страницы.
  it('разметка в теле сообщения выводится как текст', () => {
    const { container } = render(
      <MessageBubble
        body="<b>gras</b>"
        createdAt="2026-08-11T10:00:00Z"
        mine={false}
        senderName="Marie"
      />,
    );
    expect(screen.getByText('<b>gras</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('несёт машиночитаемое время', () => {
    const { container } = render(
      <MessageBubble body="A" createdAt="2026-08-11T10:00:00Z" mine={false} senderName="Marie" />,
    );
    expect(container.querySelector('time')).toHaveAttribute('datetime', '2026-08-11T10:00:00Z');
  });
});
