// src/components/common/__tests__/EmptyState.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <MemoryRouter>
        <EmptyState title="No items" description="There are no items to display." />
      </MemoryRouter>
    );

    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display.')).toBeInTheDocument();
  });

  it('renders action link when actionLabel and actionTo are provided', () => {
    render(
      <MemoryRouter>
        <EmptyState
          title="No items"
          description="There are no items to display."
          actionLabel="Add Item"
          actionTo="/add-item"
        />
      </MemoryRouter>
    );

    const actionLink = screen.getByRole('link', { name: /Add Item/i });
    expect(actionLink).toBeInTheDocument();
    expect(actionLink).toHaveAttribute('href', '/add-item');
  });
});