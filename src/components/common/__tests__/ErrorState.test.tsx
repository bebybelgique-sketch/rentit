// src/components/common/__tests__/ErrorState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorState from '../ErrorState';

/**
 * Подпись кнопки искали по «Retry» — английскому слову на французском
 * продукте. 20.09 оно завёрнуто в словарь (`retry` = «Réessayer»), и
 * проверка ищет ровно то, что человек увидит. Инвариант не менялся:
 * кнопка есть только при onRetry и зовёт именно его.
 */
const RETRY = /Réessayer/i;

describe('ErrorState', () => {
  it('renders the error message', () => {
    const errorMessage = 'Something went wrong';

    render(<ErrorState message={errorMessage} />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const mockOnRetry = vi.fn();
    const errorMessage = 'Network error';

    render(<ErrorState message={errorMessage} onRetry={mockOnRetry} />);

    const retryButton = screen.getByRole('button', { name: RETRY });
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button if onRetry is not provided', () => {
    const errorMessage = 'Another error';

    render(<ErrorState message={errorMessage} />);

    const retryButton = screen.queryByRole('button', { name: RETRY });
    expect(retryButton).not.toBeInTheDocument();
  });
});