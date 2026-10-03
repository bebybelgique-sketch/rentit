import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Поле «Forfait week-end» в выкладке. Пакет выходных длиннее четырёх дней
// не бывает (пт–пн), поэтому пакет не дешевле четырёх дней по дневной цене
// не выберется никогда — владелец узнаёт об этом при вводе, как и о
// мёртвых пакетах «3 дня» и «неделя».

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

const type = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });

describe('выкладка: тариф выходных', () => {
  it('поле есть и подписано окном сб–пн', () => {
    render(<MemoryRouter><ListItem /></MemoryRouter>);
    expect(screen.getByLabelText(/Forfait week-end \(€\)/)).toHaveAttribute('placeholder', 'du samedi au lundi');
  });

  it('пакет не дешевле трёх дней — предупреждение с формулой', () => {
    render(<MemoryRouter><ListItem /></MemoryRouter>);
    type('li-price', '90');
    type('li-pwe', '300');
    expect(screen.getByText(/Le forfait week-end \(€300\.00 ≥ 3 × €90\.00\)/)).toBeInTheDocument();
  });

  it('выгодный пакет — без предупреждения', () => {
    render(<MemoryRouter><ListItem /></MemoryRouter>);
    type('li-price', '90');
    type('li-pwe', '150');
    expect(screen.queryByText(/Le forfait week-end \(/)).not.toBeInTheDocument();
  });
});
