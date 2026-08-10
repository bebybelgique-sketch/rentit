// src/components/items/__tests__/BookingForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext'; // Предполагаем, что AuthProvider экспортируется
import BookingForm from '../BookingForm';

// Мокаем useAuth
vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Мокаем useCreateRental
vi.mock('../../../hooks/mutations/useCreateRental', () => ({
  useCreateRental: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
}));

// Мокаем сам supabase для избежания ошибок при импорте
vi.mock('../../../lib/supabase', () => ({
  supabase: {},
}));

const mockItem = {
  id: 'item-1',
  title: 'Test Drill',
  description: 'A powerful drill',
  price_per_day: 25,
  image_url: 'https://example.com/drill.jpg',
  owner_id: 'owner1',
  location: 'Brussels, BE',
  latitude: 50.8503,
  longitude: 4.3517,
  is_available: true,
  created_at: '2023-01-01T00:00:00Z',
  deposit: 50,
};

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

describe('BookingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form when user is logged in', () => {
    render(<BookingForm item={mockItem} />, { wrapper });

    expect(screen.getByLabelText(/Du/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Au/i)).toBeInTheDocument();
    expect(screen.getByText(/Réserver maintenant/i)).toBeInTheDocument();
  });

  it('calls mutateAsync on submit with correct data', async () => {
    const mockMutateAsync = vi.fn();
    (require('../../../hooks/mutations/useCreateRental').useCreateRental as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    render(<BookingForm item={mockItem} />, { wrapper });

    const startDateInput = screen.getByLabelText(/Du/i);
    const endDateInput = screen.getByLabelText(/Au/i);
    fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-10-02' } });

    const submitButton = screen.getByText(/Réserver maintenant/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        item_id: 'item-1',
        start_date: '2023-10-01',
        end_date: '2023-10-02',
        total_price: 75, // 25 * 2 + 50 deposit
        renter_id: 'user-1',
      });
    });
  });

  it('shows error message when mutation fails', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Network Error'));
    (require('../../../hooks/mutations/useCreateRental').useCreateRental as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: new Error('Network Error'),
    });

    render(<BookingForm item={mockItem} />, { wrapper });

    const startDateInput = screen.getByLabelText(/Du/i);
    const endDateInput = screen.getByLabelText(/Au/i);
    fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-10-02' } });

    const submitButton = screen.getByText(/Réserver maintenant/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    });
  });
});