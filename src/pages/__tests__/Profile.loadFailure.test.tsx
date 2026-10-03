import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Профиль не прочитан — сохранять нечем сравнивать. Форма стоит на запасных
// значениях из user_metadata, и до 03.10 «Mettre à jour le profil» был
// доступен и при загрузке, и после сбоя чтения: запасное имя записалось бы
// поверх настоящего, которое видят другие.

const profile = vi.hoisted(() => ({ current: { data: undefined as unknown, isError: false, refetch: vi.fn() } }));
const saveMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  },
}));
vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-1', user_metadata: { full_name: 'Ancien nom' } };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useProfile', () => ({ useProfile: () => profile.current }));
vi.mock('../../hooks/mutations/useUpdateProfile', () => ({
  useUpdateProfile: () => ({ mutateAsync: saveMock, isPending: false }),
}));
vi.mock('../../hooks/mutations/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/useUserReviews', () => ({ useUserReviews: () => ({ data: [] }) }));
vi.mock('../../hooks/mutations/useUploadAvatar', () => ({
  useUploadAvatar: () => ({ upload: vi.fn(), uploading: false }),
}));

import Profile from '../Profile';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><Profile /></MemoryRouter>
    </QueryClientProvider>,
  );

const saveButton = () => screen.getByRole('button', { name: /Mettre à jour le profil/i });

describe('профиль не прочитан', () => {
  beforeEach(() => {
    saveMock.mockReset();
    profile.current = { data: undefined, isError: false, refetch: vi.fn() };
  });

  it('сбой чтения — сказано прямо, с повтором; сохранить и править нельзя', () => {
    profile.current = { data: undefined, isError: true, refetch: vi.fn() };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Votre profil n’a pas pu être chargé');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByLabelText(/Nom complet/i)).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(profile.current.refetch).toHaveBeenCalled();
  });

  it('пока читается — сохранить нельзя, сбоя не объявлено', () => {
    renderPage();
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('прочитан — правится и сохраняется', () => {
    profile.current = { data: { full_name: 'Nom réel', avatar_url: null }, isError: false, refetch: vi.fn() };
    renderPage();
    const name = screen.getByLabelText(/Nom complet/i);
    expect(name).toBeEnabled();
    fireEvent.change(name, { target: { value: 'Nom corrigé' } });
    expect(saveButton()).toBeEnabled();
  });
});
