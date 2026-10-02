import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Отзыв не лёг. Причину человек видит под формой — и только её: общий тост
// мутаций здесь молчит (src/lib/mutationErrors.ts). И отказ не уходит
// необработанным обещанием: до 03.10 каждый неудачный отзыв попадал в
// client_errors как поломка приложения.

const toastError = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());

vi.mock('react-hot-toast', () => ({ default: { error: toastError, success: vi.fn() } }));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({ insert: insertMock })),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('../../../hooks/useBookingMessages', () => ({
  useBookingMessages: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../../hooks/useBookingPhotos', () => ({ useBookingPhotos: () => ({ data: [] }) }));

import BookingThread from '../BookingThread';
import { createMutationCache } from '../../../lib/mutationErrors';

// Клиент — с тем же обработчиком сбоев, что в приложении (App.tsx).
const renderThread = () =>
  render(
    <QueryClientProvider client={new QueryClient({ mutationCache: createMutationCache() })}>
      <BookingThread
        bookingId="b-1" itemId="i-1" currentUserId="u-1" counterpartyId="u-2"
        counterpartyName="Julien" status="completed" role="renter"
      />
    </QueryClientProvider>,
  );

describe('отзыв не лёг', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  let consoleError: MockInstance<any[], void>;

  beforeEach(() => {
    unhandled.length = 0;
    toastError.mockReset();
    insertMock.mockReset();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    consoleError.mockRestore();
  });

  it('причина — под формой и одна; обещание не брошено', async () => {
    // 23505 — этот отзыв уже есть (уникальный ключ брони, автора и типа).
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    renderThread();
    fireEvent.click(screen.getByRole('button', { name: '4 étoiles' }));
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'avis" }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Vous avez déjà laissé cet avis');
    expect(toastError).not.toHaveBeenCalled();
    // Необработанный отказ всплывает после очереди микрозадач — ждём её.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  });
});
