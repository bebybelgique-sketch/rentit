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
  photos: ['https://example.com/drill.jpg'],
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

  it('renders a fallback image if no photos are provided', () => {
    const itemWithoutImage = { ...mockItem, photos: [] };
    render(
      <MemoryRouter>
        <ItemCard item={itemWithoutImage} />
      </MemoryRouter>
    );

    expect(screen.getByText('🔧')).toBeInTheDocument(); // Иконка-заполнитель
  });

  it('renders the provided image if photos are present', () => {
    render(
      <MemoryRouter>
        <ItemCard item={mockItem} />
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: mockItem.title })).toBeInTheDocument();
  });

  // В базе photos — это jsonb: внутри может оказаться null или объект.
  // Такой элемент не должен доехать до src картинки пустой строкой —
  // отсюда фильтрация в photosOf, а не просто photos[0].
  it('мусор внутри photos не превращается в битую картинку', () => {
    const itemWithJunk = { ...mockItem, photos: [null, '', { url: 'x' }] as unknown as string[] };
    render(
      <MemoryRouter>
        <ItemCard item={itemWithJunk} />
      </MemoryRouter>
    );

    expect(screen.getByText('🔧')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});