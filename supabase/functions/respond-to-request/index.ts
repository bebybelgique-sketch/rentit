import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const PLATFORM_FEE_PCT = 0.00
const INSURANCE_PER_DAY = 0

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

    const { booking_id, action } = await req.json()
    if (!booking_id || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid fields' }), { status: 400, headers: CORS })
    }

    // Fetch booking with item
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*, items(*)')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: CORS })
    }

    const item = booking.items as any

    // Verify caller is the item owner
    if (item.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
    }

    // Must be pending_approval
    if (booking.status !== 'pending_approval') {
      return new Response(JSON.stringify({ error: 'Booking is no longer pending approval' }), { status: 409, headers: CORS })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // --- REJECT ---
    if (action === 'reject') {
      await supabase.from('bookings').update({ status: 'rejected' }).eq('id', booking_id)
      await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ booking_id, event: 'rejected' }),
      }).catch(() => {})

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // --- APPROVE ---
    // Double-check no blocking conflict appeared since the request was made
    const { data: conflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item.id)
      .neq('id', booking_id)
      .in('status', ['pending_payment', 'confirmed', 'active'])
      .lte('start_date', booking.end_date)
      .gte('end_date', booking.start_date)
      .maybeSingle()

    if (conflict) {
      return new Response(JSON.stringify({ error: 'These dates are no longer available' }), { status: 409, headers: CORS })
    }

    // Check if owner is Pro or B2B
    const { data: ownerProfile } = await supabase
      .from('users').select('is_pro, business_plan').eq('id', user.id).single()
    const isPro = ownerProfile?.is_pro === true || ownerProfile?.business_plan != null

    // Calculate amounts
    const start = new Date(booking.start_date)
    const end = new Date(booking.end_date)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const rentalPrice = parseFloat(item.price_per_day) * totalDays
    const deposit = parseFloat(item.deposit) || 0
    const platformFee = isPro ? 0 : rentalPrice * PLATFORM_FEE_PCT
    const insuranceFee = INSURANCE_PER_DAY * totalDays

    const rentalCents = Math.round(rentalPrice * 100)
    const depositCents = Math.round(deposit * 100)
    const feeCents = Math.round(platformFee * 100)
    const insuranceCents = Math.round(insuranceFee * 100)
    const totalCents = rentalCents + depositCents + insuranceCents

    // Create Stripe PaymentIntent (or mock when Stripe is not configured)
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    let piId: string
    if (stripeSecretKey) {
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-04-10',
        httpClient: Stripe.createFetchHttpClient(),
      })
      const pi = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'eur',
        metadata: {
          booking_id: booking.id,
          item_id: item.id,
          renter_id: booking.renter_id,
          owner_id: user.id,
          rental_amount: rentalCents,
          deposit_amount: depositCents,
          platform_fee: feeCents,
          insurance_amount: insuranceCents,
        },
      })
      piId = pi.id
    } else {
      // No Stripe key configured — use a mock ID so the flow can proceed
      piId = `pi_mock_${crypto.randomUUID().replace(/-/g, '')}`
    }

    // Update booking to pending_payment + record approved_at
    await supabase.from('bookings').update({
      status: 'pending_payment',
      approved_at: new Date().toISOString(),
      stripe_payment_intent_id: piId,
      total_price: rentalPrice,
      deposit_amount: deposit,
      platform_fee: platformFee,
    }).eq('id', booking_id)

    // Create payment record
    await supabase.from('payments').insert([{
      booking_id,
      stripe_payment_intent_id: piId,
      amount: totalCents,
      rental_amount: rentalCents,
      deposit_amount: depositCents,
      platform_fee: feeCents,
      status: 'pending',
    }])

    // Auto-reject other pending_approval requests for overlapping dates
    const { data: conflicting } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item.id)
      .eq('status', 'pending_approval')
      .neq('id', booking_id)
      .lte('start_date', booking.end_date)
      .gte('end_date', booking.start_date)

    if (conflicting && conflicting.length > 0) {
      const ids = conflicting.map((b: any) => b.id)
      await supabase.from('bookings').update({ status: 'rejected' }).in('id', ids)
      // Notify each rejected renter
      for (const b of conflicting) {
        await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ booking_id: b.id, event: 'rejected' }),
        }).catch(() => {})
      }
    }

    // Notify renter that they're approved
    await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ booking_id, event: 'approved' }),
    }).catch(() => {})

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
