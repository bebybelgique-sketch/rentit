// supabase/functions/_shared/auth.ts
import { createSupabaseServiceClient } from './supabase.ts';
import { json } from './json.ts';

/**
 * Достаёт пользователя из заголовка Authorization.
 * Возвращает либо объект пользователя, либо готовый ответ 401 — вызывающий
 * код обязан проверить: `if (res instanceof Response) return res`.
 *
 * Две вещи, на которых легко ошибиться и на которых уже ошибались:
 *  1. getUser() ждёт САМ токен, а не строку "Bearer <token>";
 *  2. ответ 401 обязан нести CORS-заголовки, иначе браузер не покажет
 *     причину, а сообщит о сетевой ошибке (ровно этот дефект 10.08 делал
 *     невозможной бронь с сайта).
 *
 * Отказ — КОДОМ `unauthorized`, как и у всех функций. До 23.09 здесь были
 * фразы («Unauthorized: Invalid or expired token»), и три функции,
 * отдававшие этот ответ как есть, показывали человеку английский текст
 * вместо «Session expirée. Reconnectez-vous». Причина отказа — в лог.
 */
export const getUserFromAuthHeader = async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.log('[auth] нет заголовка Authorization');
    return json({ error: 'unauthorized' }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    console.log('[auth] ключ входа недействителен или истёк');
    return json({ error: 'unauthorized' }, 401);
  }

  return data.user;
};
