import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

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

    const { item_id, start_date, end_date, message } = await req.json()
    if (!item_id || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: CORS })
    }

    // Fetch item
    const { data: item, error: itemErr } = await supabase
      .from('items').select('*').eq('id', item_id).single()
    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404, headers: CORS })
    }

    if (item.owner_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot rent your own item' }), { status: 400, headers: CORS })
    }
    if (!item.available) {
      return new Response(JSON.stringify({ error: 'Item is not available' }), { status: 400, headers: CORS })
    }

    // Check no blocking conflict (confirmed/active/pending_payment)
    const { data: conflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item_id)
      .in('status', ['pending_payment', 'confirmed', 'active'])
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .maybeSingle()

    if (conflict) {
      return new Response(JSON.stringify({ error: 'Item is not available for selected dates' }), { status: 409, headers: CORS })
    }

    // Prevent duplicate pending_approval from same renter
    const { data: duplicate } = await supabase
      .from('bookings')
      .select('id')
      .eq('item_id', item_id)
      .eq('renter_id', user.id)
      .eq('status', 'pending_approval')
      .lte('start_date', end_date)
      .gte('end_date', start_date)
      .maybeSingle()

    if (duplicate) {
      return new Response(JSON.stringify({ error: 'You already have a pending request for these dates' }), { status: 409, headers: CORS })
    }

    // Calculate amounts for the booking record
    const start = new Date(start_date)
    const end = new Date(end_date)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const rentalPrice = parseFloat(item.price_per_day) * totalDays
    const deposit = parseFloat(item.deposit) || 0

    // Create booking with pending_approval
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert([{
        item_id,
        renter_id: user.id,
        start_date,
        end_date,
        total_price: rentalPrice,
        deposit_amount: deposit,
        platform_fee: 0,
        status: 'pending_approval',
        request_message: message?.trim() || null,
      }])
      .select()
      .single()

    if (bookingErr) {
      return new Response(JSON.stringify({ error: bookingErr.message }), { status: 400, headers: CORS })
    }

    // Notify owner
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    await fetch(`${supabaseUrl}/functions/v1/notify-rental`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ booking_id: booking.id, event: 'pending_approval' }),
    }).catch(() => {})

    return new Response(JSON.stringify({ booking_id: booking.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
