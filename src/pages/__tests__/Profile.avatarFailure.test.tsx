import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Новый снимок профиля не лёг, а прежний уже убран из бакета — порядок
// «убрать, потом положить» вынужден политикой хранилища (useUploadAvatar).
// До 02.10 ссылка на убранный файл оставалась в профиле: битая картинка на
// каждой странице. И при удачной загрузке вместе с фото уходило имя из
// формы — недописанное, если человек начал его править.

const uploadMock = vi.hoisted(() => vi.fn());
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
  const user = { id: 'u-1', user_metadata: { full_name: 'Voisin test' } };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useProfile', () => {
  const stored = { full_name: 'Voisin test', avatar_url: 'https://cdn.example/avatars/u-1.jpg' };
  return { useProfile: () => ({ data: stored }) };
});
vi.mock('../../hooks/mutations/useUpdateProfile', () => ({
  useUpdateProfile: () => ({ mutateAsync: saveMock, isPending: false }),
}));
vi.mock('../../hooks/mutations/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/useUserReviews', () => ({ useUserReviews: () => ({ data: [] }) }));
vi.mock('../../hooks/mutations/useUploadAvatar', () => ({
  useUploadAvatar: () => ({ upload: uploadMock, uploading: false }),
}));

import Profile from '../Profile';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Profile /></MemoryRouter>
    </QueryClientProvider>,
  );

const pickPhoto = () => {
  const input = document.getElementById('avatar_file') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], 'moi.jpg', { type: 'image/jpeg' })] } });
};

describe('профиль: снимок не лёг', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    saveMock.mockReset().mockResolvedValue({});
  });

  it('прежний убран — ссылка на него стирается, а не остаётся битой', async () => {
    uploadMock.mockResolvedValue({ ok: false, reason: 'upload', text: 'Échec', previousRemoved: true });
    renderPage();
    pickPhoto();
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({ userId: 'u-1', updates: { avatar_url: null } }));
  });

  it('прежний на месте — ссылку не трогаем', async () => {
    uploadMock.mockResolvedValue({ ok: false, reason: 'upload', text: 'Échec', previousRemoved: false });
    renderPage();
    pickPhoto();
    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('удачная загрузка пишет только снимок — имя из формы не уходит', async () => {
    uploadMock.mockResolvedValue({ ok: true, url: 'https://cdn.example/avatars/u-1.png?v=1' });
    renderPage();
    pickPhoto();
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(saveMock.mock.calls[0][0].updates).toEqual({ avatar_url: 'https://cdn.example/avatars/u-1.png?v=1' });
  });
});
