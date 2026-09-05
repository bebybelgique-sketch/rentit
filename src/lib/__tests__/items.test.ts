import { describe, it, expect } from 'vitest';
import { photosOf, coverPhoto, itemHistoryOf } from '../items';

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

// item_history объявлена RETURNS jsonb: после gen types её ответ — Json.
// Страница вещи строит из last_rented дату (`+ 'T00:00:00'`), и мусор в
// этом поле давал бы «Invalid Date» посреди фразы о доверии к владельцу.

describe('itemHistoryOf', () => {
  it('читает нормальный ответ функции', () => {
    expect(itemHistoryOf({ times_rented: 7, last_rented: '2026-07-31' }))
      .toEqual({ times_rented: 7, last_rented: '2026-07-31' });
  });

  it('вещь ещё не сдавали: count 0, дата null', () => {
    expect(itemHistoryOf({ times_rented: 0, last_rented: null }))
      .toEqual({ times_rented: 0, last_rented: null });
  });

  it('не объект — сведений нет', () => {
    // Ошибка RPC отдаёт data: null, и блок истории просто не показывается.
    expect(itemHistoryOf(null)).toBeNull();
    expect(itemHistoryOf(undefined)).toBeNull();
    expect(itemHistoryOf('7')).toBeNull();
    expect(itemHistoryOf([{ times_rented: 7 }])).toBeNull();
  });

  it('дата не в формате YYYY-MM-DD отбрасывается', () => {
    // Лучше не показать дату, чем показать Invalid Date.
    expect(itemHistoryOf({ times_rented: 2, last_rented: '31/07/2026' })?.last_rented).toBeNull();
    expect(itemHistoryOf({ times_rented: 2, last_rented: 1234 })?.last_rented).toBeNull();
  });

  it('нечисловой или отрицательный счётчик читается как ноль', () => {
    // Ноль скрывает блок целиком — это честнее, чем «сдавали -1 раз».
    expect(itemHistoryOf({ times_rented: '7' })?.times_rented).toBe(0);
    expect(itemHistoryOf({ times_rented: -3 })?.times_rented).toBe(0);
    expect(itemHistoryOf({})?.times_rented).toBe(0);
  });
});
