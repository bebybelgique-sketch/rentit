import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CancellationNotice from '../CancellationNotice';

describe('CancellationNotice', () => {
  it('называет отменившего и дату', () => {
    render(
      <CancellationNotice
        cancelledByName="Marie"
        cancelledAt="2026-08-11T10:00:00Z"
        reason="Outil en panne"
      />,
    );
    expect(screen.getByText(/Annulée par Marie/)).toBeInTheDocument();
    expect(screen.getByText('Outil en panne')).toBeInTheDocument();
  });

  // Молчание тут читается как «причину скрыли», поэтому её отсутствие
  // называется прямо.
  it('отсутствие причины названо, а не спрятано', () => {
    render(
      <CancellationNotice cancelledByName="Jean" cancelledAt="2026-08-11T10:00:00Z" reason={null} />,
    );
    expect(screen.getByText('Aucune raison indiquée')).toBeInTheDocument();
  });

  it('причина из одних пробелов считается отсутствующей', () => {
    render(
      <CancellationNotice cancelledByName="Jean" cancelledAt="2026-08-11T10:00:00Z" reason="   " />,
    );
    expect(screen.getByText('Aucune raison indiquée')).toBeInTheDocument();
  });

  // Закрыл таймер — не человек. До 01.10 пустой cancelled_by приписывал
  // отмену второй стороне: каждая читала «Annulée par <имя другой>».
  it('закрытие таймером не приписывается никому из сторон', () => {
    render(
      <CancellationNotice
        cancelledByName="Marie"
        automatic
        cancelledAt="2026-08-11T10:00:00Z"
        reason="Clôturée automatiquement : la période de location est passée et la remise n'a pas été confirmée."
      />,
    );
    expect(screen.getByText(/Clôturée automatiquement/)).toBeInTheDocument();
    expect(screen.queryByText(/Annulée par/)).not.toBeInTheDocument();
    // Причину сервер пишет по-французски для всех; показывается словарная.
    expect(screen.getByText(/la remise n’a pas été confirmée/)).toBeInTheDocument();
  });
});
