import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'
import Stripe from 'https://esm.sh/stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createSupabaseServiceClient()

const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:5173'

// Создать в Stripe Dashboard → Products
const PLAN_PRICE_IDS: Record<string, string> = {
  starter:    Deno.env.get('STRIPE_B2B_STARTER_PRICE_ID')!,   // €49/mo
  growth:     Deno.env.get('STRIPE_B2B_GROWTH_PRICE_ID')!,    // €99/mo
  enterprise: Deno.env.get('STRIPE_B2B_ENTERPRISE_PRICE_ID')!, // €149/mo
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  try {
    const user = await getUserFromAuthHeader(req)
    if (user instanceof Response) return user

    const { plan, business_name } = await req.json() as { plan: string; business_name: string }

    if (!['starter', 'growth', 'enterprise'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    if (!business_name?.trim()) {
      return new Response(JSON.stringify({ error: 'Business name required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const priceId = PLAN_PRICE_IDS[plan]
    if (!priceId) {
      return new Response(JSON.stringify({ error: `Price ID for plan "${plan}" not configured` }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // Получить или создать Stripe Customer
    const { data: profile } = await supabase
      .from('users').select('stripe_customer_id, full_name').eq('id', user.id).single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // Сохранить business_name заранее
    await supabase.from('users').update({ business_name: business_name.trim() }).eq('id', user.id)

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/business/dashboard?success=1`,
      cancel_url: `${APP_URL}/business?canceled=1`,
      metadata: { supabase_user_id: user.id, b2b_plan: plan },
      subscription_data: {
        metadata: { supabase_user_id: user.id, b2b_plan: plan },
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
