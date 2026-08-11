import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import Stripe from 'https://esm.sh/stripe@14'

const supabase = createSupabaseServiceClient()

const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  try {
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return user

    const { booking_id } = await req.json()
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'Missing booking_id' }), { status: 400, headers: CORS })
    }

    // Fetch booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: CORS })
    }

    // Must be the renter
    if (booking.renter_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
    }

    // Must be pending_payment (approved by owner)
    if (booking.status !== 'pending_payment') {
      return new Response(JSON.stringify({ error: 'Booking is not awaiting payment' }), { status: 409, headers: CORS })
    }

    // Must be within 2-hour window
    if (!booking.approved_at) {
      return new Response(JSON.stringify({ error: 'Booking has no approval timestamp' }), { status: 409, headers: CORS })
    }
    const approvedAt = new Date(booking.approved_at).getTime()
    const now = Date.now()
    const remaining = PAYMENT_WINDOW_MS - (now - approvedAt)

    if (remaining <= 0) {
      // Mark as payment_expired
      await supabase.from('bookings').update({ status: 'payment_expired' }).eq('id', booking_id)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ booking_id, event: 'payment_expired' }),
      }).catch(() => {})
      return new Response(JSON.stringify({ error: 'Payment window has expired' }), { status: 410, headers: CORS })
    }

    if (!booking.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: 'No payment intent found for this booking' }), { status: 500, headers: CORS })
    }

    // Get total amount from payments table
    const { data: payment } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', booking_id)
      .single()

    // Retrieve real Stripe PaymentIntent — or return mock data when Stripe is not configured
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const isMockIntent = booking.stripe_payment_intent_id.startsWith('pi_mock_')

    let clientSecret: string
    let amount: number

    if (stripeSecretKey && !isMockIntent) {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-04-10',
        httpClient: Stripe.createFetchHttpClient(),
      })
      const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)
      clientSecret = pi.client_secret!
      amount = payment?.amount ?? pi.amount
    } else {
      // No Stripe configured — return mock values so the payment page can render
      clientSecret = `${booking.stripe_payment_intent_id}_secret_mock`
      amount = payment?.amount ?? 0
    }

    return new Response(JSON.stringify({
      client_secret: clientSecret,
      amount,
      booking_id,
      remaining_seconds: Math.floor(remaining / 1000),
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
