// expire-bookings — вызывается по расписанию pg_cron каждые 30 минут.
// Само расписание — в миграции 20260813000018.
//
// ЧТО ЗАКРЫВАЕТ ТАЙМЕР
//   pending_approval  старше суток          → expired
//   active            срок истёк + 7 дней   → completed  (+ auto_closed_at)
//   confirmed         срок истёк + 7 дней   → cancelled  (+ auto_closed_at)
//
// Два последних — потому что выход из `active` и `confirmed` был только у
// владельца. Забыл нажать — бронь жила вечно, а `delete-account` из-за неё
// навсегда отказывал обеим сторонам в удалении учётной записи.
//
// `auto_closed_at` отличает закрытие временем от подтверждённого людьми:
// продукт не знает момента фактического возврата и не вправе выдавать своё
// закрытие за чужое подтверждение.
//
// ПРОПУСК. Раньше здесь сверялся служебный ключ проекта
// (`SUPABASE_SERVICE_ROLE_KEY`), и это заставляло хранить его в команде
// крона — то есть в таблице `cron.job`, открытым текстом, доступным всякому,
// у кого есть доступ к базе. Замерено 13.08: значение в `cron.job` побайтово
// совпадало с ключом, которым ходят ВСЕ функции проекта. Ключ от всего
// лежал в базе ради задания, умеющего одно действие.
//
// Теперь пропуск отдельный — `CRON_TOKEN`, как у `cleanup-orphan-photos`.
// Он открывает ровно эту функцию и ничего больше, и его можно менять, не
// трогая ничего остального.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version, x-cron-token' }

// Сколько дней после конца аренды ждать, прежде чем закрыть бронь самим.
// Вынесено в переменную окружения ради проверяемости: на живой базе иначе
// не отличить работающий таймер от молчащего — ждать неделю, чтобы увидеть
// первый результат, значит не проверить его вовсе.
const GRACE_DAYS = Number(Deno.env.get('BOOKING_GRACE_DAYS') ?? '7')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Пропуск для планировщика. Секрет обязателен: без него функция закрыта
  // наглухо, а не открыта для всех — иначе опечатка в имени переменной
  // окружения молча распахнула бы её наружу.
  const expected = Deno.env.get('CRON_TOKEN')
  const presented = req.headers.get('X-Cron-Token')
  if (!expected || !presented || presented !== expected) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const now = new Date()

  const notify = async (ids: string[], event: string) => {
    for (const id of ids) {
      await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ booking_id: id, event }),
      }).catch(() => {})
    }
  }

  // 1. Заявки без ответа дольше суток.
  //
  // Условие по статусу стоит и в UPDATE, а не только в выборке. Между
  // SELECT и UPDATE владелец успевает нажать «одобрить» — и без этого
  // условия таймер затирал бы свежий `confirmed` на `expired`, отменяя
  // бронь, которую человек только что подтвердил. Список для писем берём
  // из ВОЗВРАЩЁННЫХ строк, а не из выборки: уведомлять надо о том, что
  // действительно изменилось.
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: expiredApproval } = await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .eq('status', 'pending_approval')
    .lt('created_at', cutoff24h)
    .select('id')

  await notify((expiredApproval ?? []).map((b: { id: string }) => b.id), 'expired')

  // 2. Брони, застрявшие после окончания срока.
  //
  // Из `active` завершить вправе только владелец, из `confirmed` передача
  // тоже за ним. Забыл нажать — бронь жила вечно, а вместе с ней держался
  // запрет на удаление учётной записи в `delete-account`.
  //
  // Неделя после конца аренды — намеренно щедро. Продукт не знает, когда
  // вещь вернулась на самом деле; он знает только, что срок истёк и никто
  // ничего не отметил. Закрытие помечается `auto_closed_at`, чтобы запись
  // не выдавала себя за подтверждённый людьми возврат.
  const graceEnd = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)

  const { data: closedActive } = await supabase
    .from('bookings')
    .update({ status: 'completed', auto_closed_at: now.toISOString() })
    .eq('status', 'active')
    .lt('end_date', graceEnd)
    .select('id')

  await notify((closedActive ?? []).map((b: { id: string }) => b.id), 'completed')

  // Передача так и не состоялась: срок аренды прошёл, вещь не уезжала.
  // Завершать тут нечего — бронь отменяется. `cancelled_by` остаётся
  // пустым: отменил не человек, а время, и приписывать это одной из сторон
  // было бы неправдой.
  const { data: closedConfirmed } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      auto_closed_at: now.toISOString(),
      cancelled_at: now.toISOString(),
      cancellation_reason: 'Clôturée automatiquement : la période de location est passée et la remise n\'a pas été confirmée.',
    })
    .eq('status', 'confirmed')
    .lt('end_date', graceEnd)
    .select('id')

  await notify((closedConfirmed ?? []).map((b: { id: string }) => b.id), 'cancelled')

  // Прежде здесь истекали брони, не оплаченные в течение 2 часов после
  // одобрения. Платежей в платформе больше нет: одобрение сразу переводит
  // бронь в confirmed, поэтому истекать нечему. Статус payment_expired
  // остаётся в enum ради старых записей, но новых не появляется.
  const expiredPayment: { id: string }[] = []

  return new Response(JSON.stringify({
    expired_approvals: expiredApproval?.length ?? 0,
    expired_payments: expiredPayment?.length ?? 0,
    closed_active: closedActive?.length ?? 0,
    closed_confirmed: closedConfirmed?.length ?? 0,
    grace_days: GRACE_DAYS,
  }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
