// expire-bookings — called by Supabase pg_cron every 30 minutes
// Setup in SQL editor — see project docs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Only service role can call this
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
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

  // 2. Expire pending_payment bookings where approved_at is older than 2 hours
  const cutoff2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const { data: expiredPayment } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'pending_payment')
    .not('approved_at', 'is', null)
    .lt('approved_at', cutoff2h)

  if (expiredPayment && expiredPayment.length > 0) {
    const ids = expiredPayment.map((b: any) => b.id)
    await supabase.from('bookings').update({ status: 'payment_expired' }).in('id', ids)
    for (const b of expiredPayment) {
      await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ booking_id: b.id, event: 'payment_expired' }),
      }).catch(() => {})
    }
  }

  return new Response(JSON.stringify({
    expired_approvals: expiredApproval?.length ?? 0,
    expired_payments: expiredPayment?.length ?? 0,
  }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
