import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Не загрузилось — не значит «пусто». До 03.10 сбой чтения переписки и
// снимков показывался как «Aucun message» и «Aucune photo»: человек читал,
// что собеседник молчит и что снимков передачи нет, хотя они лежали в базе.

const state = vi.hoisted(() => ({
  messages: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  photos: { data: undefined as unknown, isError: false, refetch: vi.fn() },
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock('../../../hooks/useBookingMessages', () => ({ useBookingMessages: () => state.messages }));
vi.mock('../../../hooks/useBookingPhotos', () => ({ useBookingPhotos: () => state.photos }));
vi.mock('../../../hooks/mutations/useSendMessage', () => ({
  useSendMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../../hooks/mutations/useUploadBookingPhoto', () => ({
  useUploadBookingPhoto: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../../hooks/mutations/useCreateUserReview', () => ({
  useCreateUserReview: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false, error: null }),
}));

import BookingThread from '../BookingThread';

const renderThread = (status: string) =>
  render(
    <BookingThread
      bookingId="b-1" itemId="i-1" currentUserId="u-1" counterpartyId="u-2"
      counterpartyName="Julien" status={status} role="renter"
    />,
  );

describe('переписка и снимки: сбой чтения ≠ пусто', () => {
  beforeEach(() => {
    state.messages = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    state.photos = { data: [], isError: false, refetch: vi.fn() };
  });

  it('переписка не прочиталась — так и сказано, с повтором; «нет сообщений» не звучит', () => {
    state.messages = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    renderThread('confirmed');
    expect(screen.getByRole('alert')).toHaveTextContent('Les messages n’ont pas pu être chargés.');
    expect(screen.queryByText(/Aucun message/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(state.messages.refetch).toHaveBeenCalled();
  });

  it('переписка прочиталась пустой — «нет сообщений», ошибки нет', () => {
    renderThread('confirmed');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('снимки при передаче не прочитались — сбой, а не «Aucune photo»', () => {
    state.photos = { data: undefined, isError: true, refetch: vi.fn() };
    renderThread('confirmed');
    expect(screen.getByRole('alert')).toHaveTextContent('Les photos n’ont pas pu être chargées.');
    expect(screen.queryByText(/Aucune photo/i)).not.toBeInTheDocument();
  });

  // У закрытой сделки раздел снимков показывался, только если они есть:
  // сбой чтения прятал единственный след состояния вещи целиком.
  it('у завершённой сделки сбой чтения снимков виден, а не прячет раздел', () => {
    state.photos = { data: undefined, isError: true, refetch: vi.fn() };
    renderThread('completed');
    expect(screen.getByText('Les photos n’ont pas pu être chargées.')).toBeInTheDocument();
  });

  it('прочитанные раньше сообщения остаются на экране, если не удалось обновить', () => {
    state.messages = {
      data: [{ id: 'm-1', body: 'Bonjour, demain 10h ?', created_at: '2026-10-03T08:00:00Z', sender_id: 'u-2', senderName: 'Julien' }],
      isLoading: false, isError: true, refetch: vi.fn(),
    };
    renderThread('confirmed');
    expect(screen.getByText('Bonjour, demain 10h ?')).toBeInTheDocument();
  });
});
