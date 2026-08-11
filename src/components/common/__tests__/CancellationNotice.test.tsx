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
});
