import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Ошибка ≠ пустота (аудит 04.10). Сбой загрузки «Моих вещей» не должен
// выглядеть как пустой аккаунт с призывом выставить первую вещь.

const query = vi.hoisted(() => ({
  data: undefined as Array<Record<string, unknown>> | undefined,
  isError: false,
  refetch: vi.fn(),
}));

// Заглушка supabase — по той же причине, что в MyItems.emptyCta.test.tsx:
// lib/supabase бросает при загрузке модуля без VITE_SUPABASE_URL.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('../../hooks/useOwnerItems', () => ({
  useOwnerItems: () => ({ data: query.data, isLoading: false, isError: query.isError, refetch: query.refetch }),
}));
vi.mock('../../hooks/mutations/useSetItemAvailability', () => ({
  useSetItemAvailability: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null }),
}));
vi.mock('../../hooks/mutations/useDeleteItem', () => ({
  useDeleteItem: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null }),
}));

import MyItems from '../MyItems';

const renderPage = () => render(<MemoryRouter><MyItems /></MemoryRouter>);

const anItem = {
  id: 'i-1', title: 'Perceuse', category: 'power_tools', available: true,
  price_per_day: 10, deposit: 0, photos: [], bookings: [],
};

describe('«Мои вещи»: сбой загрузки — не пустой аккаунт', () => {
  beforeEach(() => {
    query.data = undefined;
    query.isError = false;
    query.refetch.mockReset();
  });

  it('сбой без данных — экран ошибки с повтором, пустого состояния нет', () => {
    query.isError = true;
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent("Vos annonces n'ont pas pu être chargées.");
    expect(screen.queryByText(/Aucun outil pour l'instant/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Déposer votre premier outil/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('не удалось только перечитать — список остаётся, повтор над ним', () => {
    query.isError = true;
    query.data = [anItem];
    renderPage();
    expect(screen.getByText('Perceuse')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('успешная загрузка без вещей — пустое состояние, как прежде', () => {
    query.data = [];
    renderPage();
    expect(screen.getByText(/Aucun outil pour l'instant/i)).toBeInTheDocument();
  });
});
