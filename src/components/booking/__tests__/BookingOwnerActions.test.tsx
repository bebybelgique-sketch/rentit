import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookingOwnerActions from '../BookingOwnerActions';

// Компонент решает ровно один вопрос — какие кнопки видит владелец в этом
// состоянии брони, — и этот вопрос стоит проверять, потому что до его
// появления «передана» и «возвращена» существовали только в /my-items, а
// в /my-rentals сделка обрывалась на «Accepter».

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  supabase: { functions: { invoke } },
}));

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({
  default: { error: toastError, success: toastSuccess },
}));

const renderWith = (status: string, onDone?: (s: string) => void) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingOwnerActions bookingId="b1" status={status} onDone={onDone} />
    </QueryClientProvider>,
  );
};

describe('BookingOwnerActions', () => {
  beforeEach(() => {
    invoke.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it('на заявке предлагает принять и отклонить', () => {
    renderWith('pending_approval');
    expect(screen.getByRole('button', { name: 'Accepter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refuser' })).toBeInTheDocument();
  });

  it('на подтверждённой брони — передача и отмена', () => {
    renderWith('confirmed');
    expect(screen.getByRole('button', { name: 'Marquer récupéré' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  // Статус после передачи называется 'active'. Промах в этом имени
  // (например, 'in_progress') не сломал бы сборку — он просто убрал бы
  // кнопку возврата, и сделка навсегда осталась бы незакрытой.
  it('на выданной вещи — только возврат', () => {
    renderWith('active');
    expect(screen.getByRole('button', { name: 'Marquer retourné' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marquer récupéré' })).not.toBeInTheDocument();
  });

  it('на завершённой и отменённой брони кнопок нет', () => {
    const { container } = renderWith('completed');
    expect(container).toBeEmptyDOMElement();
    renderWith('cancelled');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('передача зовёт transition-booking и отдаёт новый статус наверх', async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: 'active' }, error: null });
    const onDone = vi.fn();
    renderWith('confirmed', onDone);

    fireEvent.click(screen.getByRole('button', { name: 'Marquer récupéré' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('active'));
    expect(invoke).toHaveBeenCalledWith('transition-booking', {
      body: { booking_id: 'b1', action: 'handover', reason: null },
    });
  });

  it('отказ показывается фразой, а не кодом', async () => {
    // Ради этого коды и заведены: 'booking_changed' на экране — то же
    // самое, что служебная фраза supabase-js, от которой мы уходили.
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        context: new Response(JSON.stringify({ error: 'booking_changed' }), { status: 409 }),
      }),
    });
    renderWith('active');

    fireEvent.click(screen.getByRole('button', { name: 'Marquer retourné' }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/La réservation a changé entre-temps/);
  });

  it('незнакомый код не выводит своё имя на экран', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        context: new Response(JSON.stringify({ error: 'some_future_code' }), { status: 500 }),
      }),
    });
    renderWith('active');

    fireEvent.click(screen.getByRole('button', { name: 'Marquer retourné' }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).not.toMatch(/some_future_code/);
  });
});
