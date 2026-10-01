import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Просьба о фото в форме выкладки ведёт в профиль. Из профиля дороги к
// форме не было: человек сохранял фото и оставался тут, а «5 минут»
// обрывались. Теперь форма кладёт state.from, и профиль после сохранения
// возвращает к ней — но только если фото действительно сохранилось.

const navigateMock = vi.hoisted(() => vi.fn());
const uploadMock = vi.hoisted(() => vi.fn());
const saveMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

// Заглушка supabase обязательна: lib/supabase бросает при загрузке модуля
// без VITE_SUPABASE_URL, а в прогоне её нет.
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
  // Один объект на весь файл: новая ссылка на каждый рендер зациклила бы
  // эффект профиля (см. Profile.destructive.test.tsx).
  const user = { id: 'u-1', user_metadata: { full_name: 'Voisin test' } };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useProfile', () => {
  const stored = { full_name: 'Voisin test', avatar_url: '' };
  return { useProfile: () => ({ data: stored }) };
});
vi.mock('../../hooks/mutations/useUpdateProfile', () => ({
  useUpdateProfile: () => ({ mutateAsync: saveMock, isPending: false }),
}));
vi.mock('../../hooks/mutations/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/useUserReviews', () => ({
  useUserReviews: () => ({ data: [] }),
}));
vi.mock('../../hooks/mutations/useUploadAvatar', () => ({
  useUploadAvatar: () => ({ upload: uploadMock, uploading: false }),
}));

import Profile from '../Profile';

const renderAt = (state?: unknown) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[{ pathname: '/profile', state }]}><Profile /></MemoryRouter>
    </QueryClientProvider>,
  );

const pickPhoto = () => {
  const input = document.getElementById('avatar_file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], 'moi.jpg', { type: 'image/jpeg' })] } });
};

describe('профиль: фото по просьбе формы выкладки', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    uploadMock.mockReset().mockResolvedValue({ ok: true, url: 'https://cdn.example/avatars/u-1.jpg' });
    saveMock.mockReset().mockResolvedValue({});
  });

  it('пришёл из формы — после сохранения фото возвращается к форме', async () => {
    renderAt({ from: '/list-item' });
    pickPhoto();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/list-item'));
  });

  it('пришёл сам — остаётся в профиле', async () => {
    renderAt();
    pickPhoto();
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalledWith('/list-item');
  });

  it('ссылка на фото не записалась — к форме не уводим: просьба повторилась бы', async () => {
    saveMock.mockRejectedValue(new Error('permission denied'));
    renderAt({ from: '/list-item' });
    pickPhoto();
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalledWith('/list-item');
  });
});
