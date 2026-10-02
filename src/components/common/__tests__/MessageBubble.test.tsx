import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import nl from '../../../locales/nl.json';
import MessageBubble from '../MessageBubble';

describe('MessageBubble', () => {
  afterEach(async () => { await i18n.changeLanguage('fr'); });

  it('своё сообщение подписано «Vous»', () => {
    render(<MessageBubble body="Salut" createdAt="2026-08-11T10:00:00Z" mine senderName="Jean" />);
    expect(screen.getByText('Vous')).toBeInTheDocument();
  });

  // Пустоты вместо имени не бывает: без имени — «Utilisateur» на языке
  // читателя (хук отдаёт null с 02.10, см. useBookingMessages.test).
  it('собеседник без имени подписан «Utilisateur», а не пустотой', () => {
    render(<MessageBubble body="Salut" createdAt="2026-08-11T10:00:00Z" mine={false} senderName={null} />);
    expect(screen.getByText('Utilisateur')).toBeInTheDocument();
  });

  // До 02.10 «Vous» было вшито и стояло над каждым своим сообщением на всех
  // трёх языках. Набор тестов поднимает только французский, поэтому такие
  // места он не видел: здесь язык переключается явно.
  it('на нидерландском — нидерландские подписи', async () => {
    i18n.addResourceBundle('nl', 'translation', nl, true, true);
    await i18n.changeLanguage('nl');
    render(<MessageBubble body="Hoi" createdAt="2026-08-11T10:00:00Z" mine senderName="Jan" />);
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.queryByText('Vous')).not.toBeInTheDocument();
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
