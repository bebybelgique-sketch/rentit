import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let items: Array<Record<string, unknown>> = [];

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('../../hooks/useOwnerItems', () => ({
  useOwnerItems: () => ({ data: items, isLoading: false, isError: false }),
}));
vi.mock('../../hooks/mutations/useSetItemAvailability', () => ({
  useSetItemAvailability: () => ({ mutate: vi.fn(), error: null }),
}));
vi.mock('../../hooks/mutations/useDeleteItem', () => ({
  useDeleteItem: () => ({ mutate: vi.fn(), error: null }),
}));

import MyItems from '../MyItems';

const renderPage = () => render(<MemoryRouter><MyItems /></MemoryRouter>);

const anItem = {
  id: 'i-1', title: 'Perceuse', category: 'power_tools', available: true,
  price_per_day: 10, deposit: 0, photos: [], bookings: [],
};

describe('«Мои вещи»: сколько красных кнопок ведёт в одно место', () => {
  beforeEach(() => { items = []; });

  // Правило продукта из #39: красный — глагол. На пустом экране глагол был
  // ОДИН, а красных кнопок три, и все вели в /list-item: в шапке, в пустом
  // состоянии и круглая на нижней панели. Когда красным выделено всё, не
  // выделено ничего.
  it('при пустом списке кнопка в шапке не показывается', () => {
    renderPage();
    const toList = screen.getAllByRole('link').filter(a => a.getAttribute('href') === '/list-item');
    expect(toList).toHaveLength(1);
  });

  // Убрана именно кнопка шапки: пустое состояние предлагает то же действие,
  // но с объяснением.
  it('действие при этом не пропало — его несёт пустое состояние', () => {
    renderPage();
    expect(screen.getByText(/Aucun outil pour l'instant/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Déposer votre premier outil/i }))
      .toHaveAttribute('href', '/list-item');
  });

  // Когда вещи есть, пустого состояния нет — и дубля не возникает, поэтому
  // кнопка шапки возвращается.
  it('когда вещи есть, кнопка в шапке возвращается', () => {
    items = [anItem];
    renderPage();
    const toList = screen.getAllByRole('link').filter(a => a.getAttribute('href') === '/list-item');
    expect(toList).toHaveLength(1);
    expect(screen.queryByText(/Aucun outil pour l'instant/i)).not.toBeInTheDocument();
  });
});
