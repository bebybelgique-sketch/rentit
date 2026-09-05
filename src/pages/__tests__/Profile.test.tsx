// src/pages/__tests__/Profile.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext'; // Предполагаем, что AuthProvider экспортируется
import { supabase } from '../../lib/supabase';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

// AuthProvider на монтировании зовёт supabase.auth.getSession() и подписку —
// без заглушек рендер падает ещё до самой страницы.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));
import Profile from '../Profile';
import { useUpdateProfile } from '../../hooks/mutations/useUpdateProfile'; // Import hook to mock
import { useDeleteAccount } from '../../hooks/mutations/useDeleteAccount'; // Import hook to mock

// Мокаем useAuth
vi.mock('../../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAuth: vi.fn(() => ({ user: { id: 'user-1', user_metadata: { full_name: 'John Doe' } } })),
  };
});

// Мокаем useUpdateProfile
vi.mock('../../hooks/mutations/useUpdateProfile');

// Мокаем useDeleteAccount
vi.mock('../../hooks/mutations/useDeleteAccount');

const queryClient = new QueryClient();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock return values
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it('renders the profile form when user is logged in', () => {
    render(<Profile />, { wrapper });

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('calls mutateAsync on update profile form submit', async () => {
    const mockMutateAsync = vi.fn();
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<Profile />, { wrapper });

    const newNameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(newNameInput, { target: { value: 'Jane Doe' } });

    const submitButton = screen.getByText(/Mettre à jour le profil/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Лишнее поле в таблице users отсутствует — оно убрано и из типа, и из формы.
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: 'user-1',
        updates: {
          full_name: 'Jane Doe',
          avatar_url: '', // Не изменилось
        }
      });
    });
  });

  it('calls mutateAsync on delete account button click with confirmation', async () => {
    const mockMutateAsync = vi.fn();
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    // Мокаем window.confirm
    const confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Profile />, { wrapper });

    const deleteButton = screen.getByText(/Supprimer mon compte/i);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.");
      // Удаление идёт через edge-функцию, пользователя она берёт из токена,
      // поэтому аргументов у мутации нет.
      expect(mockMutateAsync).toHaveBeenCalledWith();
    });

    confirmMock.mockRestore();
  });

  it('redirects even when signOut fails after account deletion', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    vi.mocked(supabase.auth.signOut).mockRejectedValueOnce(new Error('sign out failed'));
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Profile />, { wrapper });
    fireEvent.click(screen.getByText(/Supprimer mon compte/i));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith();
      expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
    });

    confirmMock.mockRestore();
  });
});