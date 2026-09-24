import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ListingStart } from '../../hooks/useListingStart';

// Замер 23.09 в роли нового соседа с телефона: пять инструментов подряд —
// пять просьб о фото профиля и пять раз «Utiliser ma position». Здесь
// держатся три инварианта, которые это чинят:
//
//   1. форма не показывается, пока не известно, что ей нужно (иначе её
//      сменяет просьба о фото на глазах — было 177 мс → 391 мс);
//   2. «Plus tard» держится до конца сессии вкладки и только для этого
//      человека;
//   3. позиция прошлого объявления стоит в форме сразу, и человек видит,
//      откуда она.

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

let userId = 'u-1';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: userId } }) }));

let startState: { isPending: boolean; data?: ListingStart } = { isPending: true };
vi.mock('../../hooks/useListingStart', () => ({
  NO_START: { needsPhoto: false, lastPlace: null },
  useListingStart: () => startState,
}));

import ListItem from '../ListItem';

const renderPage = () => render(<MemoryRouter><ListItem /></MemoryRouter>);
const ready = (data: ListingStart) => { startState = { isPending: false, data }; };

describe('форма выкладки: что известно до показа', () => {
  beforeEach(() => {
    sessionStorage.clear();
    userId = 'u-1';
    startState = { isPending: true };
  });

  it('пока ответа нет — ни формы, ни просьбы', () => {
    renderPage();
    expect(document.querySelector('#li-title')).toBeNull();
    expect(screen.queryByRole('button', { name: /Plus tard/ })).toBeNull();
  });

  it('отказ проверки — форма, а не пустой экран', () => {
    startState = { isPending: false, data: undefined };
    renderPage();
    expect(document.querySelector('#li-title')).not.toBeNull();
  });

  it('«Plus tard» не спрашивается снова при следующем объявлении той же сессии', () => {
    ready({ needsPhoto: true, lastPlace: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Plus tard — déposer mon outil/ }));
    expect(document.querySelector('#li-title')).not.toBeNull();

    // Следующее объявление — страница монтируется заново.
    cleanup();
    renderPage();
    expect(screen.queryByRole('button', { name: /Plus tard/ })).toBeNull();
    expect(document.querySelector('#li-title')).not.toBeNull();
  });

  it('отказ одного человека не снимает просьбу с другого на той же вкладке', () => {
    ready({ needsPhoto: true, lastPlace: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Plus tard — déposer mon outil/ }));

    cleanup();
    userId = 'u-2';
    renderPage();
    expect(screen.getByRole('button', { name: /Plus tard — déposer mon outil/ })).toBeInTheDocument();
  });

  it('позиция прошлого объявления стоит сразу, и сказано, откуда она', () => {
    ready({ needsPhoto: false, lastPlace: { lat: 50.717, lng: 4.601, address: 'Rue de la Station 12, Walhain' } });
    renderPage();
    expect(screen.getByRole('button', { name: 'Position enregistrée' })).toBeInTheDocument();
    expect(screen.getByText(/Même endroit que votre annonce précédente : Rue de la Station 12, Walhain\./)).toBeInTheDocument();
  });

  it('нет прошлого объявления с позицией — кнопка просит позицию', () => {
    ready({ needsPhoto: false, lastPlace: null });
    renderPage();
    expect(screen.getByRole('button', { name: 'Utiliser ma position' })).toBeInTheDocument();
    expect(screen.queryByText(/annonce précédente/)).toBeNull();
  });

  it('новая позиция с телефона заменяет прошлую, и ссылка на прошлое объявление уходит', () => {
    ready({ needsPhoto: false, lastPlace: { lat: 50.717, lng: 4.601, address: null } });
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 50.5, longitude: 4.8 } } as GeolocationPosition));
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    renderPage();
    expect(screen.getByText(/annonce précédente : 50\.7170, 4\.6010/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Position enregistrée' }));
    expect(screen.getByText('50.5000, 4.8000')).toBeInTheDocument();
    expect(screen.queryByText(/annonce précédente/)).toBeNull();
  });
});
