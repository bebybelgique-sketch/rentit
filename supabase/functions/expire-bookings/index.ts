// expire-bookings — вызывается по расписанию pg_cron каждые 30 минут.
// Само расписание — в миграции 20260813000018.
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

  // 1. Expire pending_approval bookings older than 24 hours
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: expiredApproval } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'pending_approval')
    .lt('created_at', cutoff24h)

  if (expiredApproval && expiredApproval.length > 0) {
    const ids = expiredApproval.map((b: any) => b.id)
    await supabase.from('bookings').update({ status: 'expired' }).in('id', ids)
    for (const b of expiredApproval) {
      await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ booking_id: b.id, event: 'expired' }),
      }).catch(() => {})
    }
  }

  // Прежде здесь истекали брони, не оплаченные в течение 2 часов после
  // одобрения. Платежей в платформе больше нет: одобрение сразу переводит
  // бронь в confirmed, поэтому истекать нечему. Статус payment_expired
  // остаётся в enum ради старых записей, но новых не появляется.
  const expiredPayment: { id: string }[] = []

  return new Response(JSON.stringify({
    expired_approvals: expiredApproval?.length ?? 0,
    expired_payments: expiredPayment?.length ?? 0,
  }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
