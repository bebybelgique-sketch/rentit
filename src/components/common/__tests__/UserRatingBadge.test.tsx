import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserRatingBadge from '../UserRatingBadge';

describe('UserRatingBadge', () => {
  // Новичка нельзя показывать как оценённого на ноль: это хуже, чем
  // честное «его ещё не оценивали».
  it('без отзывов пишет об их отсутствии, а не ноль', () => {
    render(<UserRatingBadge rating={null} role="owner" />);
    expect(screen.getByText(/Pas encore d'avis/)).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('показывает оценку и количество отзывов', () => {
    render(<UserRatingBadge rating={4.5} count={12} role="owner" />);
    expect(screen.getByText('4,5')).toBeInTheDocument();
    expect(screen.getByText('(12 avis)')).toBeInTheDocument();
    expect(screen.getByText('en tant que propriétaire')).toBeInTheDocument();
  });

  it('различает роль владельца и арендатора', () => {
    render(<UserRatingBadge rating={5} role="renter" />);
    expect(screen.getByText('en tant que locataire')).toBeInTheDocument();
  });
});
