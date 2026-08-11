import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'

const supabase = createSupabaseServiceClient()
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_PHONE')!
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  // Раньше здесь 401 отдавался без CORS-заголовков — из браузера это выглядело
  // как сетевая ошибка, а не как «нужен вход».
  const user = await getUserFromAuthHeader(req)
  if (user instanceof Response) return user

  const { action, phone, otp } = await req.json()

  if (action === 'send') {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabase.from('users').update({
      phone,
      phone_otp: code,
      phone_otp_expires_at: expires,
    }).eq('id', user.id)

    const body = new URLSearchParams({
      From: TWILIO_FROM,
      To: phone,
      Body: `Your RentIt verification code: ${code}. Valid for 10 minutes.`,
    })

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    )

    if (!twilioRes.ok) {
      const err = await twilioRes.json()
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: CORS })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (action === 'verify') {
    const { data: userData } = await supabase
      .from('users').select('phone_otp, phone_otp_expires_at').eq('id', user.id).single()

    if (!userData?.phone_otp) {
      return new Response(JSON.stringify({ error: 'No OTP found' }), { status: 400, headers: CORS })
    }
    if (new Date() > new Date(userData.phone_otp_expires_at)) {
      return new Response(JSON.stringify({ error: 'Code expired' }), { status: 400, headers: CORS })
    }
    if (userData.phone_otp !== otp) {
      return new Response(JSON.stringify({ error: 'Incorrect code' }), { status: 400, headers: CORS })
    }

    await supabase.from('users').update({
      phone_verified: true,
      phone_otp: null,
      phone_otp_expires_at: null,
    }).eq('id', user.id)

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS })
})
