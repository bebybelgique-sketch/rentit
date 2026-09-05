// supabase/functions/admin-action/index.ts
//
// Единственный путь для действий администратора над чужими строками.
//
// ПОЧЕМУ ФУНКЦИЯ, А НЕ UPDATE ИЗ БРАУЗЕРА. Потому что второе не работает и
// работать не должно. Политика на users пришпиливает role к текущему
// значению, а грант на UPDATE выдан поимённо на шесть безобидных столбцов
// (20260812000017) — кнопка «Make admin» в /admin нажималась и не делала
// ничего. Расширить права клиента было бы худшим из решений: получить
// право менять роли значит получить право выдать их себе.
//
// ЧТО ЗДЕСЬ ВАЖНО ПОНИМАТЬ. Ниже создаётся служебный клиент, который RLS
// НЕ ПРИМЕНЯЕТ. Значит вся авторизация — руками и до первой записи:
//   1) кто зовёт (токен),
//   2) администратор ли он ПО БАЗЕ,
//   3) входит ли просимое в закрытый список действий,
//   4) не снимает ли он права сам с себя.
//
// ПОЧЕМУ РОЛЬ ЧИТАЕТСЯ ИЗ ТАБЛИЦЫ, А НЕ ИЗ КЛЕЙМОВ ТОКЕНА. Клейм живёт до
// истечения токена: снятые права продолжали бы действовать час после
// снятия. Запрос к users стоит один round-trip и отвечает на вопрос
// «сейчас», а не «на момент выдачи токена».
//
// Ответы — КОДАМИ ('forbidden', 'cannot_demote_self'), не фразами: язык
// подбирает клиент, см. src/domain/serverErrors.ts.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import { json } from '../_shared/json.ts'
import { parseAction, targetOf, patchOf, isSelfDemotion, type AdminAction } from './actions.ts'

const supabase = createSupabaseServiceClient()

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    // 1. Кто зовёт.
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return json({ error: 'unauthorized' }, 401)

    // 2. Администратор ли он — по базе, а не по токену.
    const { data: caller, error: callerErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerErr) {
      console.error('[admin-action] role lookup failed', { actor: user.id, callerErr })
      return json({ error: 'internal_error' }, 500)
    }
    // Отсутствие строки и роль «не admin» — один и тот же ответ: посторонний
    // не должен по коду ответа выяснять, есть ли он в таблице.
    if (caller?.role !== 'admin') return json({ error: 'forbidden' }, 403)

    // 3. Что именно просят. Всё, чего нет в списке, — отказ.
    const action = parseAction(await req.json().catch(() => null))
    if (!action) return json({ error: 'bad_request' }, 400)

    // 4. Предохранитель от «последний админ разлогинил админку».
    if (isSelfDemotion(action, user.id)) return json({ error: 'cannot_demote_self' }, 400)

    // 5. Чтение счётчиков — отдельная ветка: ни строки не меняет, в журнал
    // не пишется. Считает служебный клиент, потому что под правами самого
    // администратора цифры получаются ЛИЧНЫЕ: RLS на bookings и payments
    // показывает ему только его собственные строки, а выглядят они на
    // вкладке Stats как общие по площадке.
    if (action.type === 'get_stats') return await stats()

    const target = targetOf(action)
    // Недостижимо: цель есть у каждого изменяющего действия, а
    // единственное читающее разобрано выше. Строка нужна ради ошибки
    // компиляции, если появится третий вид действий.
    if (!target) return json({ error: 'bad_request' }, 400)

    const { data, error } = await supabase
      .from(target.table)
      .update(patchOf(action))
      .eq('id', target.id)
      // Возвращаем изменённую строку: клиент показывает ПРИШЕДШЕЕ
      // состояние, а не то, которое он собирался получить.
      .select(target.table === 'users' ? 'id, role' : 'id, available')
      .maybeSingle()

    if (error) {
      console.error('[admin-action] update failed', { actor: user.id, action, error })
      return json({ error: 'update_failed' }, 500)
    }
    // Ноль строк — это не сбой записи, а несуществующая цель: строку удалили,
    // пока админ смотрел на список. Отдельный код, чтобы человек понял, что
    // список устарел, и обновил его.
    if (!data) return json({ error: 'target_not_found' }, 404)

    await audit(user.id, action)

    return json({ ok: true, [target.table === 'users' ? 'user' : 'item']: data })
  } catch (err) {
    console.error('[admin-action] unhandled', err)
    return json({ error: 'internal_error' }, 500)
  }
})

/**
 * Счётчики площадки целиком.
 *
 * Комиссии и выручки среди них нет намеренно: платформа денег не берёт и
 * не держит (см. scripts/check-claims.mjs). Плитка «Revenue (platform fee)»
 * в /admin показывала сумму platform_fee из payments — то есть обещала
 * доход от модели, которой в продукте больше нет.
 */
async function stats() {
  const count = async (table: string, apply?: (q: any) => any) => {
    const base = supabase.from(table).select('*', { count: 'exact', head: true })
    const { count: n, error } = await (apply ? apply(base) : base)
    if (error) throw error
    return n ?? 0
  }

  try {
    const [users, items, bookings, completed] = await Promise.all([
      count('users'),
      count('items'),
      count('bookings'),
      count('bookings', (q: any) => q.eq('status', 'completed')),
    ])
    return json({ ok: true, stats: { users, items, bookings, completed } })
  } catch (error) {
    console.error('[admin-action] stats failed', { error })
    return json({ error: 'internal_error' }, 500)
  }
}

/**
 * Строка в журнал. Пишется ПОСЛЕ успешной записи: журнал обязан отражать
 * то, что произошло, а не то, что собирались сделать.
 *
 * Неудача журнала не роняет операцию — она уже состоялась, и откатить её
 * ответом «ошибка» нельзя, — но и не проходит молча: расхождение между
 * базой и журналом должно быть видно в логах функции.
 */
async function audit(actorId: string, action: AdminAction) {
  const target = targetOf(action)
  if (!target) return
  const { error } = await supabase.from('admin_audit_log').insert({
    actor_id: actorId,
    action: action.type,
    target_table: target.table,
    target_id: target.id,
    payload: action,
  })
  if (error) console.error('[admin-action] audit insert failed', { actorId, action, error })
}
