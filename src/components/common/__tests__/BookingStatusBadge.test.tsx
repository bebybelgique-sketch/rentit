// src/components/common/__tests__/BookingStatusBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingStatusBadge from '../BookingStatusBadge';

describe('BookingStatusBadge', () => {
  it('renders the correct french label for pending_approval', () => {
    render(<BookingStatusBadge status="pending_approval" />);
    expect(screen.getByText(/En attente d'approbation/i)).toBeInTheDocument();
  });

  it('renders the correct french label for confirmed', () => {
    render(<BookingStatusBadge status="confirmed" />);
    expect(screen.getByText(/Confirmé/i)).toBeInTheDocument();
  });

  it('renders the correct french label for completed', () => {
    render(<BookingStatusBadge status="completed" />);
    expect(screen.getByText(/Terminé/i)).toBeInTheDocument();
  });

  it('renders the correct french label for cancelled', () => {
    render(<BookingStatusBadge status="cancelled" />);
    expect(screen.getByText(/Annulé/i)).toBeInTheDocument();
  });

  // Add more tests for other statuses as needed...
});