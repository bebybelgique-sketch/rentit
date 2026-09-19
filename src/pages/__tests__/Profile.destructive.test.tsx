import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Заглушка supabase обязательна: Profile тянет lib/supabase, а тот БРОСАЕТ
// прямо при загрузке модуля, если нет VITE_SUPABASE_URL. Локально переменная
// лежит в .env, в CI её нет — и тест, зелёный на машине, валит прогон.
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
  // Объект создаётся ОДИН раз, внутри фабрики. Возвращать новый на каждый
  // вызов нельзя: useEffect в Profile зависит от идентичности storedProfile,
  // и новая ссылка на каждый рендер даёт бесконечную петлю — прогон съедает
  // кучу и падает по памяти. В проде react-query отдаёт стабильную ссылку.
  const user = { id: 'u-1', user_metadata: { full_name: 'Propriétaire test' } };
  return { useAuth: () => ({ user }) };
});
vi.mock('../../hooks/useProfile', () => {
  const stored = { full_name: 'Propriétaire test', avatar_url: '' };
  return { useProfile: () => ({ data: stored }) };
});
vi.mock('../../hooks/mutations/useUpdateProfile', () => ({
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../../hooks/mutations/useDeleteAccount', () => ({
  useDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// Отзывы по умолчанию отсутствуют: блок «Avis reçus» не должен появляться
// у того, кому ещё ничего не написали.
let reviewsAsOwner: unknown[] = [];
let reviewsAsRenter: unknown[] = [];
vi.mock('../../hooks/useUserReviews', () => ({
  useUserReviews: (_id: string | undefined, role: 'owner' | 'renter') => ({
    data: role === 'owner' ? reviewsAsOwner : reviewsAsRenter,
  }),
}));

vi.mock('../../hooks/mutations/useUploadAvatar', () => ({
  useUploadAvatar: () => ({ upload: vi.fn(), uploading: false }),
}));

import Profile from '../Profile';

// Provider нужен потому, что Profile сам зовёт useQueryClient — он чистит
// кэш после удаления учётки. Запросы замоканы, клиент остаётся пустым.
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Profile /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('профиль: разрушительное действие отличимо от обычного', () => {
  // ГЛАВНЫЙ ИНВАРИАНТ. Токены --action и --danger в этом продукте — один и
  // тот же #C8102E. Пока удаление залито тем же красным, что и «сохранить»,
  // необратимое удаление учётки выглядит ровно как сохранение имени.
  // Поэтому удаление рисуется КОНТУРОМ — так же, как «Supprimer» в «Моих
  // вещах». Проверяется не цвет (он совпадает), а заливка.
  it('удаление учётки нарисовано контуром, а не заливкой', () => {
    renderPage();
    const del = screen.getByRole('button', { name: /Supprimer mon compte/i });
    expect(del.style.background).toBe('transparent');
    expect(del.style.border).toContain('var(--danger)');
  });

  it('сохранение остаётся залитым — оно обычное действие', () => {
    renderPage();
    const save = screen.getByRole('button', { name: /Mettre à jour le profil/i });
    expect(save).toHaveClass('btn-primary');
    expect(save.style.background).not.toBe('transparent');
  });

  // Сырой <input type="file"> рисует браузер, и он показывал «Choose File ·
  // No file chosen» — английскую надпись, которую не переведёт ни один
  // словарь. Теперь нажатие передаёт кнопка, а поле скрыто.
  it('выбор снимка идёт через кнопку, а поле скрыто', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Choisir une photo/i })).toBeInTheDocument();
    const input = document.querySelector<HTMLInputElement>('#avatar_file');
    expect(input).not.toBeNull();
    expect(input!.style.display).toBe('none');
  });

  // «Danger Zone» стояло во французском словаре непереведённым — английская
  // идиома посреди французского экрана.
  it('заголовок раздела говорит по-французски', () => {
    renderPage();
    expect(screen.getByText('Zone de danger')).toBeInTheDocument();
    expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
  });
});

describe('профиль: отзывы о человеке наконец видны', () => {
  const review = (id: string, author: string, rating: number, comment: string) => ({
    id, booking_id: 'b-1', from_user_id: 'x', to_user_id: 'u-1',
    review_type: 'owner', rating, comment,
    created_at: '2026-09-10T10:00:00Z',
    authorName: author, authorAvatarUrl: null,
  });

  beforeEach(() => { reviewsAsOwner = []; reviewsAsRenter = []; });

  // ДЫРА, РАДИ КОТОРОЙ ЭТО НАПИСАНО. Отзыв о человеке писать было куда
  // (ReviewForm внутри переписки по брони), а читать — негде: хук
  // useUserReviews не звал никто, ReviewList не отрисовывался нигде. Оба
  // написаны и покрыты тестами, их просто не соединили. Человека просили
  // потратить усилие на текст, которого не увидит ни он, ни кто-либо ещё.
  it('полученный отзыв показан вместе с автором и текстом', () => {
    reviewsAsOwner = [review('r-1', 'Marc D.', 5, 'Perceuse impeccable, voisin ponctuel.')];
    renderPage();
    expect(screen.getByText('Avis reçus')).toBeInTheDocument();
    expect(screen.getByText(/Perceuse impeccable/i)).toBeInTheDocument();
    expect(screen.getByText(/Marc D\./)).toBeInTheDocument();
  });

  // «Отзывов пока нет» в собственном профиле — витрина собственной пустоты,
  // та же, из-за которой в истории вещи не пишут «сдавалась 0 раз».
  it('без отзывов блока нет вовсе', () => {
    renderPage();
    expect(screen.queryByText('Avis reçus')).not.toBeInTheDocument();
  });

  // Две репутации разные: «хорошо сдаёт» и «хорошо берёт». Разделение
  // заложено в схеме (review_type), и сводить их в кучу значит его потерять.
  it('роли подписаны врозь', () => {
    reviewsAsOwner = [review('r-1', 'Marc D.', 5, 'Bien.')];
    reviewsAsRenter = [{ ...review('r-2', 'Sophie L.', 4, 'Rendu propre.'), review_type: 'renter' }];
    renderPage();
    expect(screen.getByText('En tant que propriétaire')).toBeInTheDocument();
    expect(screen.getByText('En tant que locataire')).toBeInTheDocument();
  });

  it('пустая роль своей подписи не показывает', () => {
    reviewsAsOwner = [review('r-1', 'Marc D.', 5, 'Bien.')];
    renderPage();
    expect(screen.getByText('En tant que propriétaire')).toBeInTheDocument();
    expect(screen.queryByText('En tant que locataire')).not.toBeInTheDocument();
  });
});
