import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Замена главного снимка вещи: новый файл → запись в базу → удаление
// старого. До 02.10 старый файл удалялся ДО записи: упала запись — файла
// уже нет, а база ссылается на него, и главное фото объявления битое на
// витрине без возможности вернуть.

// vi.hoisted: фабрики vi.mock поднимаются в начало файла, и обычные
// константы к их запуску ещё не объявлены (AGENTS.md, правило 2).
const { OLD, NEW } = vi.hoisted(() => {
  const BASE = 'https://proj.supabase.co/storage/v1/object/public/item-photos/';
  return { OLD: `${BASE}items/u-1/old.jpg`, NEW: `${BASE}items/u-1/new.jpg` };
});

const calls = vi.hoisted(() => [] as string[]);
const removeMock = vi.hoisted(() => vi.fn());
const mutateAsync = vi.hoisted(() => vi.fn());
const uploadImage = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    storage: { from: () => ({ remove: removeMock }) },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    })),
  },
}));

vi.mock('../../context/AuthContext', () => {
  const user = { id: 'u-1' };
  return { useAuth: () => ({ user }) };
});

vi.mock('../../hooks/useItemById', () => {
  const item = {
    id: 'i-1', owner_id: 'u-1', title: 'Perceuse', description: 'Perceuse Bosch 18 V', price_per_day: 10,
    price_3days: null, price_week: null, late_fee_per_day: null, delivery_fee: null, delivery_radius_km: null,
    deposit: 0, category: 'power_tools', condition: 'good', address: '1457 Walhain', lat: null, lng: null,
    available: true, quantity: 1, min_notice_days: 0, buffer_days: 0, photos: [OLD],
  };
  return { useItemById: () => ({ data: item, isLoading: false, error: null }) };
});

vi.mock('../../hooks/mutations/useUpdateItem', () => ({
  useUpdateItem: () => ({ mutateAsync, isPending: false, isError: false, error: null }),
}));

vi.mock('../../hooks/useUploadImage', () => ({
  useUploadImage: () => [uploadImage, false, null],
}));

// Перерывы владельца — отдельный компонент со своими запросами; здесь не нужен.
vi.mock('../../components/ItemBlackouts', () => ({ default: () => null }));

import EditItem from '../EditItem';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/edit-item/i-1']}>
        <Routes><Route path="/edit-item/:id" element={<EditItem />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const replacePhotoAndSave = async () => {
  const input = document.getElementById('image') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], 'new.jpg', { type: 'image/jpeg' })] } });
  fireEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));
};

describe('правка вещи: замена снимка ничего не теряет', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    uploadImage.mockReset().mockImplementation(async () => { calls.push('upload'); return NEW; });
    removeMock.mockReset().mockImplementation(async (paths: string[]) => { calls.push(`remove ${paths.join(',')}`); return { error: null }; });
    mutateAsync.mockReset();
  });

  it('запись прошла — старый файл удаляется ПОСЛЕ записи', async () => {
    mutateAsync.mockImplementation(async () => { calls.push('save'); });
    renderPage();
    await replacePhotoAndSave();
    await waitFor(() => expect(calls).toEqual(['upload', 'save', 'remove items/u-1/old.jpg']));
  });

  it('запись упала — старый файл на месте, убран только новый', async () => {
    mutateAsync.mockImplementation(async () => { calls.push('save'); throw new Error('null value in column "deposit"'); });
    renderPage();
    await replacePhotoAndSave();
    await waitFor(() => expect(calls).toEqual(['upload', 'save', 'remove items/u-1/new.jpg']));
  });

  // Поля «видна на витрине» в форме нет — и в базу оно уходить не должно:
  // снимок из формы молча возвращал на витрину вещь, скрытую в другой вкладке.
  it('сохранение не трогает видимость вещи', async () => {
    mutateAsync.mockImplementation(async () => { calls.push('save'); });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].updates).not.toHaveProperty('available');
  });
});
