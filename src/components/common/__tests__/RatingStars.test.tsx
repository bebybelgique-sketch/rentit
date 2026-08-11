import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RatingStars from '../RatingStars';

describe('RatingStars', () => {
  it('показ не даёт кнопок: нажимать нечего', () => {
    render(<RatingStars value={4} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Note : 4 sur 5');
  });

  it('в режиме оценки каждая звезда — кнопка с внятным именем', () => {
    render(<RatingStars value={0} interactive onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '1 étoile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4 étoiles' })).toBeInTheDocument();
  });

  it('сообщает выбранную оценку', () => {
    const onChange = vi.fn();
    render(<RatingStars value={0} interactive onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '3 étoiles' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
