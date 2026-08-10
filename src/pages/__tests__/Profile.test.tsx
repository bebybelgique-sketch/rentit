// src/pages/__tests__/Profile.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext'; // Предполагаем, что AuthProvider экспортируется
import Profile from '../Profile';

// Мокаем useAuth
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', user_metadata: { full_name: 'John Doe', bio: 'Software Engineer' } } })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Мокаем useUpdateProfile
vi.mock('../../hooks/mutations/useUpdateProfile', () => ({
  useUpdateProfile: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
}));

// Мокаем useDeleteAccount
vi.mock('../../hooks/mutations/useDeleteAccount', () => ({
  useDeleteAccount: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
}));

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
  });

  it('renders the profile form when user is logged in', () => {
    render(<Profile />, { wrapper });

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Software Engineer')).toBeInTheDocument();
  });

  it('calls mutateAsync on update profile form submit', async () => {
    const mockMutateAsync = vi.fn();
    (require('../../hooks/mutations/useUpdateProfile').useUpdateProfile as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    render(<Profile />, { wrapper });

    const newNameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(newNameInput, { target: { value: 'Jane Doe' } });

    const submitButton = screen.getByText(/Mettre à jour le profil/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: 'user-1',
        updates: {
          full_name: 'Jane Doe',
          bio: 'Software Engineer', // Не изменилось
          avatar_url: '', // Не изменилось
        }
      });
    });
  });

  it('calls mutateAsync on delete account button click with confirmation', async () => {
    const mockMutateAsync = vi.fn();
    (require('../../hooks/mutations/useDeleteAccount').useDeleteAccount as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    // Мокаем window.confirm
    const confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Profile />, { wrapper });

    const deleteButton = screen.getByText(/Supprimer mon compte/i);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.");
      expect(mockMutateAsync).toHaveBeenCalledWith('user-1');
    });

    confirmMock.mockRestore();
  });
});