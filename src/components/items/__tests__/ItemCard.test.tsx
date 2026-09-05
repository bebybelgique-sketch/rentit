// src/components/items/__tests__/ItemCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ItemCard from '../ItemCard';

const mockItem = {
  id: '1',
  owner_id: 'owner1',
  title: 'Test Drill',
  description: 'A powerful drill',
  category: 'tools',
  condition: 'good',
  price_per_day: 25,
  price_3days: 60,
  price_week: 140,
  late_fee_per_day: 5,
  deposit: 30,
  photos: ['https://example.com/drill.jpg'],
  lat: 50.8503,
  lng: 4.3517,
  address: 'Brussels, BE',
  available: true,
  quantity: 1,
  buffer_days: 2,
  min_notice_days: 1,
  delivery_fee: null,
  delivery_radius_km: null,
  created_at: '2023-01-01T00:00:00Z',
  location: null,
  is_business: false,
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