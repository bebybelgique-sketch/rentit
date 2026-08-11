import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewList from '../ReviewList';

describe('ReviewList', () => {
  it('пустой список объясняет отсутствие отзывов', () => {
    render(<ReviewList reviews={[]} />);
    expect(screen.getByText('Aucun avis pour le moment')).toBeInTheDocument();
  });

  it('показывает автора, оценку и текст', () => {
    render(
      <ReviewList
        reviews={[{
          id: 'r1', authorName: 'Marie', authorAvatarUrl: null,
          rating: 5, comment: 'Super', createdAt: '2026-08-11T10:00:00Z',
        }]}
      />,
    );
    expect(screen.getByText('Marie')).toBeInTheDocument();
    expect(screen.getByText('Super')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Note de Marie/ })).toBeInTheDocument();
  });

  it('отзыв без комментария не рисует пустой абзац', () => {
    const { container } = render(
      <ReviewList
        reviews={[{
          id: 'r1', authorName: 'Jean', rating: 4, comment: null,
          createdAt: '2026-08-11T10:00:00Z',
        }]}
      />,
    );
    expect(screen.getByText('Jean')).toBeInTheDocument();
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
