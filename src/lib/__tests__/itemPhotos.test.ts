import { describe, it, expect } from 'vitest';
import { itemPhotoPath, itemPhotoPaths, ITEM_PHOTOS_BUCKET } from '../itemPhotos';

// Разбор адреса — единственное, что стоит между «снимок удалён» и «снимок
// остался в публичном бакете навсегда». Ошибись здесь на один сегмент, и
// удаление тихо перестанет находить файлы: Storage вернёт успех на пустой
// список, а обещание политики конфиденциальности останется невыполненным.

const PUBLIC_BASE = `https://abc.supabase.co/storage/v1/object/public/${ITEM_PHOTOS_BUCKET}`;

describe('itemPhotoPath', () => {
  it('достаёт путь из публичного адреса нашего бакета', () => {
    expect(itemPhotoPath(`${PUBLIC_BASE}/items/uid-1/1755000000000-abc.jpg`))
      .toBe('items/uid-1/1755000000000-abc.jpg');
  });

  it('отбрасывает строку запроса', () => {
    expect(itemPhotoPath(`${PUBLIC_BASE}/items/uid-1/a.jpg?t=123`))
      .toBe('items/uid-1/a.jpg');
  });

  it('возвращает null на чужих адресах — по ним удалять нечего', () => {
    expect(itemPhotoPath('https://example.com/drill.jpg')).toBeNull();
    expect(itemPhotoPath('https://abc.supabase.co/storage/v1/object/public/avatars/uid-1.jpg')).toBeNull();
  });

  it('возвращает null на пустых значениях', () => {
    expect(itemPhotoPath(null)).toBeNull();
    expect(itemPhotoPath(undefined)).toBeNull();
    expect(itemPhotoPath('')).toBeNull();
  });
});

describe('itemPhotoPaths', () => {
  it('оставляет только свои адреса и сохраняет порядок', () => {
    expect(itemPhotoPaths([
      `${PUBLIC_BASE}/items/uid-1/a.jpg`,
      'https://example.com/external.jpg',
      `${PUBLIC_BASE}/items/uid-1/b.jpg`,
    ])).toEqual(['items/uid-1/a.jpg', 'items/uid-1/b.jpg']);
  });

  it('терпит не-массив и мусор внутри', () => {
    expect(itemPhotoPaths(null)).toEqual([]);
    expect(itemPhotoPaths('строка')).toEqual([]);
    expect(itemPhotoPaths([null, 42, `${PUBLIC_BASE}/items/uid-1/a.jpg`]))
      .toEqual(['items/uid-1/a.jpg']);
  });
});
