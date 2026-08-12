import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function notifyRental(bookingId: string, event: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/notify-rental`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: JSON.stringify({ booking_id: bookingId, event }),
  }).catch(() => {})
}

serve(async (req) => {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook Error: ${err}`, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const bookingId = pi.metadata.booking_id
    if (!bookingId) return new Response('No booking_id', { status: 400 })

    const { error: payErr } = await supabase.from('payments')
      .update({ status: 'succeeded' })
      .eq('stripe_payment_intent_id', pi.id)
    if (payErr) console.error('[stripe-webhook] payment update error:', payErr.message)

    const { error: bookErr } = await supabase.from('bookings')
      .update({ status: 'confirmed', amount_paid: pi.amount_received })
      .eq('id', bookingId)
    if (bookErr) {
      console.error('[stripe-webhook] booking confirm error:', bookErr.message)
      // Return 500 so Stripe retries — do NOT notify yet
      return new Response(`Booking update failed: ${bookErr.message}`, { status: 500 })
    }

    await notifyRental(bookingId, 'confirmed')
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    const bookingId = pi.metadata.booking_id
    if (!bookingId) return new Response('OK', { status: 200 })

    const { error: payErr } = await supabase.from('payments')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', pi.id)
    if (payErr) console.error('[stripe-webhook] payment failed update error:', payErr.message)

    const { error: bookErr } = await supabase.from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
    if (bookErr) console.error('[stripe-webhook] booking cancel error:', bookErr.message)
  }

  // Pro & B2B subscriptions: activated or renewed
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata.supabase_user_id
    if (userId && sub.status === 'active') {
      const expiresAt = new Date((sub.current_period_end as number) * 1000).toISOString()
      const b2bPlan = sub.metadata.b2b_plan  // 'starter' | 'growth' | 'enterprise' | undefined

      if (b2bPlan) {
        // B2B plan
        await supabase.from('users')
          .update({ business_plan: b2bPlan, business_plan_expires_at: expiresAt })
          .eq('id', userId)
      } else {
        // Personal Pro
        await supabase.from('users')
          .update({ is_pro: true, pro_expires_at: expiresAt })
          .eq('id', userId)
      }
    }
  }

  // Pro & B2B subscriptions: cancelled or expired
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata.supabase_user_id
    if (userId) {
      const b2bPlan = sub.metadata.b2b_plan
      if (b2bPlan) {
        await supabase.from('users')
          .update({ business_plan: null, business_plan_expires_at: null })
          .eq('id', userId)
      } else {
        await supabase.from('users')
          .update({ is_pro: false, pro_expires_at: null })
          .eq('id', userId)
      }
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const piId = charge.payment_intent as string

    await supabase.from('payments')
      .update({ status: 'refunded' })
      .eq('stripe_payment_intent_id', piId)

    const { data: payment } = await supabase.from('payments')
      .select('booking_id').eq('stripe_payment_intent_id', piId).single()

    if (payment) {
      await supabase.from('bookings')
        .update({ status: 'cancelled', deposit_returned: true })
        .eq('id', payment.booking_id)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
