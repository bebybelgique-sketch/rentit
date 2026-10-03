import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// «Je peux venir avec l'engin» в выкладке (миграция 54): тумблер поверх
// одного поля цены, как у доставки. Галка без цены — обещание услуги, условий
// которой никто не знает, — отказ здесь, а не невнятный ответ базы.

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('../../hooks/useListingStart', () => ({
  NO_START: { needsPhoto: false, lastPlace: null },
  useListingStart: () => ({ isPending: false, data: { needsPhoto: false, lastPlace: null } }),
}));

import ListItem from '../ListItem';

describe('выкладка: оператор', () => {
  it('поля цены нет, пока галка не стоит', () => {
    render(<MemoryRouter><ListItem /></MemoryRouter>);
    expect(document.getElementById('li-operator-fee')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Je peux venir avec l’engin/));
    expect(screen.getByLabelText('Prix de l’opérateur (€ / jour)')).toBeInTheDocument();
  });

  it('галка без цены — отказ с объяснением', () => {
    render(<MemoryRouter><ListItem /></MemoryRouter>);
    fireEvent.change(document.getElementById('li-title') as HTMLInputElement, { target: { value: 'Mini-pelle' } });
    fireEvent.change(document.getElementById('li-price') as HTMLInputElement, { target: { value: '90' } });
    fireEvent.click(screen.getByLabelText(/Je peux venir avec l’engin/));
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(screen.getByText('Indiquez le prix de l’opérateur, ou décochez la case.')).toBeInTheDocument();
  });
});
