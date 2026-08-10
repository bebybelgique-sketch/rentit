// src/components/items/__tests__/BookingForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext'; // Предполагаем, что AuthProvider экспортируется
import BookingForm from '../BookingForm';
import { useCreateRental } from '../../../hooks/mutations/useCreateRental'; // Import hook to mock

// Мокаем useAuth
vi.mock('../../../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
  };
});

// Мокаем useCreateRental
vi.mock('../../../hooks/mutations/useCreateRental');

// Мокаем сам supabase для избежания ошибок при импорте
// Пустой объект здесь не годится: дерево оборачивается в настоящий
// AuthProvider, а он на монтировании зовёт supabase.auth.getSession() и
// подписывается на onAuthStateChange. Без этих заглушек падает весь рендер.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
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
    // Reset default mock return values
    vi.mocked(useCreateRental).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it('renders the form when user is logged in', () => {
    render(<BookingForm item={mockItem} />, { wrapper });

    // На первом рендере есть только поля дат: блок с ценой и кнопкой
    // компонент показывает лишь когда выбран непустой период.
    expect(screen.getByLabelText(/Du/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Au/i)).toBeInTheDocument();
    expect(screen.queryByText(/Réserver maintenant/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Du/i), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(/Au/i), { target: { value: '2026-10-02' } });

    expect(screen.getByText(/Réserver maintenant/i)).toBeInTheDocument();
  });

  it('calls mutateAsync on submit with correct data', async () => {
    const mockMutateAsync = vi.fn();
    vi.mocked(useCreateRental).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    render(<BookingForm item={mockItem} />, { wrapper });

    const startDateInput = screen.getByLabelText(/Du/i);
    const endDateInput = screen.getByLabelText(/Au/i);
    fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-10-02' } });

    const submitButton = screen.getByText(/Réserver maintenant/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Цену и арендатора определяет сервер, клиент их не шлёт.
      expect(mockMutateAsync).toHaveBeenCalledWith({
        item_id: 'item-1',
        start_date: '2023-10-01',
        end_date: '2023-10-02',
        message: '',
      });
    });
  });

  it('shows error message when mutation fails', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Network Error'));
    vi.mocked(useCreateRental).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
      error: new Error('Network Error'),
    } as never);

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