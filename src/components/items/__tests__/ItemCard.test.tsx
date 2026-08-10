// src/components/items/__tests__/ItemCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ItemCard from '../ItemCard';

const mockItem = {
  id: '1',
  title: 'Test Drill',
  description: 'A powerful drill',
  price_per_day: 25,
  image_url: 'https://example.com/drill.jpg',
  owner_id: 'owner1',
  location: 'Brussels, BE',
  latitude: 50.8503,
  longitude: 4.3517,
  is_available: true,
  created_at: '2023-01-01T00:00:00Z',
};

describe('ItemCard', () => {
  it('renders item title and price', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItem} />
      </MemoryRouter>
    );

    expect(screen.getByText(mockItem.title)).toBeInTheDocument();
    expect(screen.getByText(`€${mockItem.price_per_day}/jour`)).toBeInTheDocument();
  });

  it('renders a fallback image if no image_url is provided', () => {
    const itemWithoutImage = { ...mockItem, image_url: '' };
    render(
      <MemoryRouter>
        <ItemCard item={itemWithoutImage} />
      </MemoryRouter>
    );

    expect(screen.getByText('🔧')).toBeInTheDocument(); // Иконка-заполнитель
  });

  it('renders the provided image if image_url is present', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItem} />
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: mockItem.title })).toBeInTheDocument();
  });
});