import { describe, it, expect } from 'vitest';
import { planSweep, type StorageEntry } from '../sweep';

// Единственный код в проекте, который удаляет чужие файлы. Проверяем не то,
// что он «что-то нашёл», а что он находит РОВНО осиротевшее и не трогает
// остального: ошибка в одну сторону оставляет мусор, в другую — сносит
// снимок с живой витрины.

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-08-13T12:00:00Z');
const old = (h: number) => new Date(NOW - h * HOUR).toISOString();

/** Плоское дерево `путь → дата` превращаем в `list`, как у Storage. */
const fakeStorage = (files: Record<string, string | null>) => {
  const calls: string[] = [];
  const list = async (prefix: string): Promise<StorageEntry[]> => {
    calls.push(prefix);
    const seen = new Map<string, StorageEntry>();
    for (const [path, created] of Object.entries(files)) {
      if (prefix && !path.startsWith(`${prefix}/`)) continue;
      const rest = prefix ? path.slice(prefix.length + 1) : path;
      const head = rest.split('/')[0];
      const isFile = rest === head;
      if (!seen.has(head)) seen.set(head, { name: head, created_at: isFile ? created : null });
    }
    return [...seen.values()];
  };
  return { list, calls };
};

describe('planSweep — item-photos', () => {
  const files = {
    'items/uid-1/живой.jpg': old(50),
    'items/uid-1/осиротевший.jpg': old(50),
    'items/uid-2/свежий.jpg': old(0.25), // 15 минут назад
  };

  it('удаляет только то, на что нет ссылки в базе', async () => {
    const { list } = fakeStorage(files);
    const plan = await planSweep({
      list,
      known: new Set(['items/uid-1/живой.jpg']),
      root: 'items',
      depth: 1,
      minAgeMs: HOUR,
      now: NOW,
    });

    expect(plan.orphans).toEqual(['items/uid-1/осиротевший.jpg']);
    expect(plan.scanned).toBe(3);
    expect(plan.checked).toBe(1);
  });

  it('не трогает файл моложе выдержки — между загрузкой и записью в базу есть щель', async () => {
    const { list } = fakeStorage({ 'items/uid-2/свежий.jpg': old(0.25) });
    const plan = await planSweep({ list, known: new Set(), root: 'items', depth: 1, minAgeMs: HOUR, now: NOW });

    expect(plan.orphans).toEqual([]);
    expect(plan.scanned).toBe(1);
  });

  it('не трогает файл без даты создания: выдержку проверить нечем', async () => {
    const { list } = fakeStorage({ 'items/uid-3/без-даты.jpg': null });
    const plan = await planSweep({ list, known: new Set(), root: 'items', depth: 1, minAgeMs: HOUR, now: NOW });

    expect(plan.orphans).toEqual([]);
  });

  it('не выходит за свой корень: чужие папки бакета не обходятся', async () => {
    const { list, calls } = fakeStorage({
      'items/uid-1/своё.jpg': old(50),
      'avatars-мусор/чужое.jpg': old(50),
    });
    const plan = await planSweep({ list, known: new Set(), root: 'items', depth: 1, minAgeMs: HOUR, now: NOW });

    expect(plan.orphans).toEqual(['items/uid-1/своё.jpg']);
    expect(calls.every((c) => c.startsWith('items'))).toBe(true);
  });
});

describe('planSweep — booking-photos', () => {
  // Тот же обход от пустого корня: <booking_id>/<phase>/<файл>.
  const files = {
    'booking-1/before/a.jpg': old(50),
    'booking-1/after/b.jpg': old(50),
    'booking-2/before/c.jpg': old(50),
  };

  it('находит сироту среди двух броней и двух фаз', async () => {
    const { list } = fakeStorage(files);
    const plan = await planSweep({
      list,
      known: new Set(['booking-1/before/a.jpg', 'booking-1/after/b.jpg']),
      root: '',
      depth: 2,
      minAgeMs: HOUR,
      now: NOW,
    });

    expect(plan.orphans).toEqual(['booking-2/before/c.jpg']);
    expect(plan.scanned).toBe(3);
  });

  it('на пустом бакете возвращает нули, а не падает', async () => {
    const { list } = fakeStorage({});
    const plan = await planSweep({ list, known: new Set(), root: '', depth: 2, minAgeMs: HOUR, now: NOW });

    expect(plan).toEqual({ checked: 0, scanned: 0, orphans: [] });
  });

  it('всё удерживается ссылками — удалять нечего', async () => {
    const { list } = fakeStorage(files);
    const plan = await planSweep({
      list,
      known: new Set(Object.keys(files)),
      root: '',
      depth: 2,
      minAgeMs: HOUR,
      now: NOW,
    });

    expect(plan.orphans).toEqual([]);
    expect(plan.scanned).toBe(3);
  });
});
