// src/lib/edgeInvoke.ts
//
// Один способ звать edge-функции — и одно место, где ответ об отказе
// превращается в код.
//
// ПОЧЕМУ ЭТОТ ФАЙЛ ВООБЩЕ ПОЯВИЛСЯ. `supabase.functions.invoke` при
// не-2xx кладёт в `data` НИЧЕГО, а тело ответа прячет в `error.context`
// (это Response). Поэтому привычная строчка
//
//   if (error) throw new Error(data?.error || error.message)
//
// никогда не доходила до `data.error` — она всегда бросала фирменное
// «Edge Function returned a non-2xx status code». Человек видел эту фразу
// вместо «даты уже заняты», а разработчик — вместо кода ошибки. Тело,
// которое сервер честно прислал, просто выбрасывалось.

import { supabase } from './supabase';

/**
 * Отказ edge-функции, разобранный до кода.
 *
 * `code` — то, что прислал сервер (`{ "error": "dates_unavailable" }`), и
 * ровно по нему клиент выбирает текст: см. src/domain/serverErrors.ts.
 * `status` — HTTP-код, когда он известен; нужен в логах, не на экране.
 */
export class EdgeError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, status?: number) {
    // message = code намеренно: код виден в стеке и в логах, а весь
    // существующий код, читающий error.message, продолжает работать.
    super(code);
    this.name = 'EdgeError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Отказы, у которых нет и не может быть тела: до функции не дошёл сам
 * запрос. Различать их обязательно — совет человеку РАЗНЫЙ:
 *
 *   FunctionsFetchError — запрос не ушёл: офлайн, оборванный wifi,
 *     заблокированный запрос. Помогает «проверьте соединение».
 *   FunctionsRelayError — до функции не достучался сам Supabase. Человек
 *     здесь бессилен, помогает только «попробуйте позже».
 *
 * Оба раньше сваливались в 'internal_error' и показывались как «что-то
 * пошло не так» — то есть в метро при пропавшей сети человек читал, что
 * сломался сервер, и жал кнопку ещё раз.
 *
 * Сверяем по `name`, а не через `instanceof`: при двух копиях
 * @supabase/functions-js в дереве зависимостей instanceof молча ложен, и
 * различение исчезло бы без единой ошибки сборки.
 */
const TRANSPORT_CODES: Record<string, string> = {
  FunctionsFetchError: 'network',
  FunctionsRelayError: 'service_unavailable',
};

/** Тело отказа: `{ error: 'код' }`. Всё прочее — нераспознанный ответ. */
const codeFromBody = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  const err = (body as { error?: unknown }).error;
  return typeof err === 'string' && err ? err : null;
};

/**
 * Тело ответа из `error.context`, прочитанное защищённо.
 *
 * Оно может отсутствовать (сетевой сбой), быть не-JSON (падение рантайма
 * функции отдаёт текст), а поток — быть уже вычитанным. Ни один из этих
 * случаев не должен подменить причину отказа исключением разбора, поэтому
 * читаем копию и любую неудачу считаем «тела нет».
 */
const readBody = async (
  context: { json?: () => Promise<unknown>; clone?: () => Response } | undefined,
): Promise<unknown> => {
  if (!context) return null;
  try {
    const source = typeof context.clone === 'function' ? context.clone() : context;
    if (typeof source.json !== 'function') return null;
    return await source.json();
  } catch {
    return null;
  }
};

/**
 * Вызывает функцию и возвращает её тело. Любой отказ — исключение
 * `EdgeError` с кодом; вызывающему не надо разбирать три разные формы
 * неудачи (`error`, `data.error`, пустой ответ) в каждом хуке заново.
 */
export async function invokeEdge<T extends object>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>(name, { body });

  if (error) {
    // Сеть и релей — раньше разбора тела: тела у них нет по определению,
    // и попытка достать оттуда код дала бы 'internal_error'.
    const transport = TRANSPORT_CODES[(error as Error).name];
    if (transport) throw new EdgeError(transport);

    const context = (error as { context?: unknown }).context as
      | (Partial<Response> & { json?: () => Promise<unknown>; clone?: () => Response })
      | undefined;

    throw new EdgeError(
      codeFromBody(await readBody(context)) ?? codeFromBody(data) ?? 'internal_error',
      typeof context?.status === 'number' ? context.status : undefined,
    );
  }

  // 2xx с телом об ошибке — так отвечали старые функции; поддерживаем,
  // пока такие остаются.
  const inlineCode = codeFromBody(data);
  if (inlineCode) throw new EdgeError(inlineCode, 200);

  if (!data) throw new EdgeError('internal_error');

  return data;
}
