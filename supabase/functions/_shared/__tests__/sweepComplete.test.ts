import { describe, it, expect } from 'vitest';
import { fetchAllRows, listAllEntries, type CountedPage, type StorageEntry } from '../sweep';

// Уборка решает «сирота» по тому, чего НЕТ в базе. Значит, неполное знание
// о базе — это не мусор, а удаление живых файлов. Здесь проверяется ровно
// это: выборка либо полная, либо уборка не идёт.

/** Таблица из n строк за «сервером» с лимитом maxRows на ответ. */
const table = (n: number, maxRows: number) => {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number): Promise<CountedPage<{ id: number }>> => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + maxRows, n);
    return { data: rows.slice(from, end), error: null, count: n };
  };
  return { page, calls };
};

describe('fetchAllRows — ссылки из базы целиком', () => {
  it('таблица больше одной страницы — приходит целиком', async () => {
    const { page } = table(2500, 1000);
    const rows = await fetchAllRows(page, 1000);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toEqual({ id: 2499 });
  });

  // ГЛАВНОЕ. Сервер режет ответ МЕНЬШЕ нашей страницы (Max rows = 500 при
  // странице 1000). Первая редакция с одним select получила бы 500 строк из
  // 1200 и записала бы остальные 700 в сироты.
  it('сервер режет ответ меньше страницы — всё равно приходит целиком', async () => {
    const { page } = table(1200, 500);
    const rows = await fetchAllRows(page, 1000);
    expect(rows).toHaveLength(1200);
  });

  it('счёт не сошёлся — бросает, а не отдаёт неполное', async () => {
    const lying = async (): Promise<CountedPage<{ id: number }>> => ({ data: [], error: null, count: 10 });
    await expect(fetchAllRows(lying)).rejects.toThrow(/неполная/);
  });

  it('нет точного счёта — бросает: полноту не проверить', async () => {
    const uncounted = async (): Promise<CountedPage<{ id: number }>> => ({ data: [{ id: 1 }], error: null, count: null });
    await expect(fetchAllRows(uncounted)).rejects.toThrow(/счёта/);
  });

  it('ошибка базы — бросает', async () => {
    const broken = async (): Promise<CountedPage<{ id: number }>> => ({ data: null, error: { message: 'timeout' }, count: null });
    await expect(fetchAllRows(broken)).rejects.toThrow('timeout');
  });

  it('пустая таблица — пустой список, без лишних запросов', async () => {
    const { page, calls } = table(0, 1000);
    expect(await fetchAllRows(page)).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe('listAllEntries — папка Storage целиком', () => {
  const folder = (n: number) => Array.from({ length: n }, (_, i): StorageEntry => ({ name: `f${i}.jpg`, created_at: null }));

  // До 01.10 list звался без offset: всегда первая сотня, и сироты дальше
  // сотой позиции в папке не находились никогда.
  it('больше сотни файлов — видны все', async () => {
    const files = folder(250);
    const got = await listAllEntries(async (offset, limit) => files.slice(offset, offset + limit), 100);
    expect(got).toHaveLength(250);
    expect(got[249].name).toBe('f249.jpg');
  });

  it('ровно сотня — ещё один запрос и остановка на пустой странице', async () => {
    const files = folder(100);
    let calls = 0;
    const got = await listAllEntries(async (offset, limit) => { calls++; return files.slice(offset, offset + limit); }, 100);
    expect(got).toHaveLength(100);
    expect(calls).toBe(2);
  });
});
