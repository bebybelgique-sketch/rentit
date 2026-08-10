import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const PLATFORM_FEE_PCT = 0.00  // BETA: 0% until 50 completed Stripe bookings (return to 0.08 after milestone)
const INSURANCE_PER_DAY = 0  // BETA: free protection until 50 Stripe transactions (will become €3/day)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

    const { item_id, start_date, end_date } = await req.json()
    if (!item_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: CORS })
    }

    // Fetch item
    const { data: item, error: itemErr } = await supabase
      .from('items').select('*').eq('id', item_id).single()
    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404, headers: CORS })
    }

    // Can't rent own item
    if (item.owner_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot rent your own item' }), { status: 400, headers: CORS })
    }

    // Item must be available
    if (!item.available) {
      return new Response(JSON.stringify({ error: 'Item is not available' }), { status: 400, headers: CORS })
    }

    // Check no active booking for these dates (trigger will also enforce)
    const { data: conflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item_id)
      .not('status', 'in', '(cancelled,pending_payment)')
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .maybeSingle()

    if (conflict) {
      return new Response(JSON.stringify({ error: 'Item is not available for selected dates' }), { status: 409, headers: CORS })
    }

    // Check if owner is Pro or B2B (0% commission)
    const { data: ownerProfile } = await supabase
      .from('users').select('is_pro, business_plan').eq('id', item.owner_id).single()
    const isPro = ownerProfile?.is_pro === true || ownerProfile?.business_plan != null

    // Calculate amounts
    const start = new Date(start_date)
    const end = new Date(end_date)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const rentalPrice = parseFloat(item.price_per_day) * totalDays
    const deposit = parseFloat(item.deposit) || 0
    const platformFee = isPro ? 0 : rentalPrice * PLATFORM_FEE_PCT
    const insuranceFee = INSURANCE_PER_DAY * totalDays

    // Amounts in cents
    const rentalCents = Math.round(rentalPrice * 100)
    const depositCents = Math.round(deposit * 100)
    const feeCents = Math.round(platformFee * 100)
    const insuranceCents = Math.round(insuranceFee * 100)
    const totalCents = rentalCents + depositCents + insuranceCents

    // Create booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert([{
        item_id,
        renter_id: user.id,
        start_date,
        end_date,
        total_price: rentalPrice,
        deposit_amount: deposit,
        platform_fee: platformFee,
        insurance_amount: insuranceFee,
        status: 'pending_payment',
      }])
      .select()
      .single()

    if (bookingErr) {
      return new Response(JSON.stringify({ error: bookingErr.message }), { status: 400, headers: CORS })
    }

    // Create Stripe PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'eur',
      metadata: {
        booking_id: booking.id,
        item_id,
        renter_id: user.id,
        owner_id: item.owner_id,
        rental_amount: rentalCents,
        deposit_amount: depositCents,
        platform_fee: feeCents,
        insurance_amount: insuranceCents,
      },
    })

    // Store payment record
    await supabase.from('payments').insert([{
      booking_id: booking.id,
      stripe_payment_intent_id: pi.id,
      amount: totalCents,
      rental_amount: rentalCents,
      deposit_amount: depositCents,
      platform_fee: feeCents,
      status: 'pending',
    }])

    // Link PI to booking
    await supabase.from('bookings')
      .update({ stripe_payment_intent_id: pi.id })
      .eq('id', booking.id)

    return new Response(JSON.stringify({
      client_secret: pi.client_secret,
      amount: totalCents,
      booking_id: booking.id,
      insurance_amount: insuranceCents,
      owner_is_pro: isPro,
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
