import { describe, it, expect } from 'vitest';
import { photosOf, coverPhoto } from '../items';

// Колонка photos в базе — jsonb, а не string[]. Пока типы писались руками,
// приложение верило себе на слово; после supabase gen types поле станет
// Json, и соблазн будет один — расставить `as string[]` по компонентам.
// Проверка живёт в одном месте, и вот что она обязана выдерживать.

describe('photosOf', () => {
  it('возвращает строки как есть', () => {
    expect(photosOf({ photos: ['a.jpg', 'b.jpg'] })).toEqual(['a.jpg', 'b.jpg']);
  });

  it('пустое объявление — пустой список, а не исключение', () => {
    expect(photosOf({ photos: [] })).toEqual([]);
    expect(photosOf({ photos: null })).toEqual([]);
    expect(photosOf({})).toEqual([]);
    expect(photosOf(null)).toEqual([]);
    expect(photosOf(undefined)).toEqual([]);
  });

  it('не-массив в jsonb не роняет страницу', () => {
    // jsonb допускает и объект, и строку, и число — витрина обязана это
    // пережить, а не показать белый экран.
    expect(photosOf({ photos: { url: 'a.jpg' } })).toEqual([]);
    expect(photosOf({ photos: 'a.jpg' })).toEqual([]);
    expect(photosOf({ photos: 42 })).toEqual([]);
  });

  it('мусор внутри массива отбрасывается поштучно', () => {
    // Ключевой случай: null между ссылками. Без фильтрации он доезжал бы
    // в src картинки и давал битую иконку вместо следующего снимка.
    expect(photosOf({ photos: ['a.jpg', null, '', { u: 1 }, 'b.jpg'] })).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('coverPhoto', () => {
  it('берёт первый настоящий снимок', () => {
    expect(coverPhoto({ photos: ['a.jpg', 'b.jpg'] })).toBe('a.jpg');
    expect(coverPhoto({ photos: [null, 'b.jpg'] })).toBe('b.jpg');
  });

  it('без снимков отвечает null, а не пустой строкой', () => {
    // Пустая строка в src — это запрос к самой странице и битая иконка;
    // null читается вызывающим как «показать заглушку».
    expect(coverPhoto({ photos: [] })).toBeNull();
    expect(coverPhoto(undefined)).toBeNull();
  });
});
