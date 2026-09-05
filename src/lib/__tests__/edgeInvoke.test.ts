import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invokeEdge, EdgeError } from '../edgeInvoke';

// Ради чего этот модуль вообще существует: supabase-js при не-2xx кладёт
// тело ответа в error.context и НЕ кладёт его в data. Три хука подряд
// читали data?.error, никогда до него не доходили и показывали человеку
// «Edge Function returned a non-2xx status code» вместо причины отказа.

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../supabase', () => ({
  supabase: { functions: { invoke } },
}));

const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(body), { status }),
  });

describe('invokeEdge', () => {
  beforeEach(() => invoke.mockReset());

  it('возвращает тело успешного ответа', async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: 'active' }, error: null });
    await expect(invokeEdge('transition-booking', { booking_id: 'b1' }))
      .resolves.toEqual({ ok: true, status: 'active' });
  });

  it('достаёт код из тела не-2xx ответа', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(409, { error: 'dates_unavailable' }) });
    await expect(invokeEdge('respond-to-request', {})).rejects.toMatchObject({
      code: 'dates_unavailable',
      status: 409,
    });
  });

  it('не портит тело для второго читателя', async () => {
    // Response читается один раз. Если бы разбор съедал оригинал, любой
    // другой обработчик получил бы пустой поток — поэтому читаем копию.
    const error = httpError(403, { error: 'forbidden' });
    invoke.mockResolvedValue({ data: null, error });
    await expect(invokeEdge('admin-action', {})).rejects.toBeInstanceOf(EdgeError);
    await expect((error.context as Response).json()).resolves.toEqual({ error: 'forbidden' });
  });

  it('не-JSON тело не подменяет причину исключением разбора', async () => {
    // Падение рантайма функции отдаёт текст, а не JSON.
    const error = Object.assign(new Error('non-2xx'), {
      context: new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    });
    invoke.mockResolvedValue({ data: null, error });
    await expect(invokeEdge('admin-action', {})).rejects.toMatchObject({
      code: 'internal_error',
      status: 502,
    });
  });

  it('сетевой сбой без тела даёт общий код', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
    await expect(invokeEdge('admin-action', {})).rejects.toMatchObject({ code: 'internal_error' });
  });

  it('ошибка в теле ответа 2xx тоже становится исключением', async () => {
    // Так отвечают функции, которые ещё не перешли на коды статуса.
    invoke.mockResolvedValue({ data: { error: 'not_pending' }, error: null });
    await expect(invokeEdge('respond-to-request', {})).rejects.toMatchObject({ code: 'not_pending' });
  });

  it('пустой успешный ответ — это не успех', async () => {
    invoke.mockResolvedValue({ data: null, error: null });
    await expect(invokeEdge('admin-action', {})).rejects.toMatchObject({ code: 'internal_error' });
  });
});
