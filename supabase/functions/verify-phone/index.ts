import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { getUserFromAuthHeader } from '../_shared/auth.ts'

// Подтверждение телефона: статус, отправка кода, проверка кода.
//
// ОТКАЗЫ — КОДАМИ, НЕ ФРАЗАМИ. До 21.09 функция отвечала 'No OTP found',
// 'Code expired', 'Incorrect code' и пересказом ответа Twilio. Клиент
// показывал это как есть: английские фразы на французском продукте, и
// перевести их было негде — строки живут в Deno, куда словари не смотрят.
// Договор продукта другой и записан в src/domain/serverErrors.ts: сервер
// отдаёт КОД, текст подбирает клиент, у которого есть выбранный язык.
//
// ЧТО ЕЩЁ БЫЛО НЕ ТАК И ПОЧЕМУ ЭТО ВАЖНО:
//
//   1. Смена номера НЕ СБРАСЫВАЛА подтверждение. `send` писал новый
//      `phone`, не трогая `phone_verified`. То есть подтвердил номер А,
//      запросил код на Б — и значок «téléphone vérifié» на странице вещи
//      продолжал висеть, утверждая про Б то, что проверяли про А. Значок
//      доверия, который врёт, хуже отсутствующего.
//   2. Номер не проверялся ВООБЩЕ: в колонку уходила любая строка.
//   3. Попытки ввода кода не считались — см. миграцию 39.
//   4. Повторный запрос кода не ограничивался ничем: кнопка «отправить»
//      была бесплатным способом слать SMS за чужой счёт.
//   5. Отсутствие ключей Twilio выяснялось только в момент запроса к нему,
//      и наружу шла фраза провайдера. Теперь это отдельный код, и он
//      честно говорит: канал не настроен, дело не в тебе.

const supabase = createSupabaseServiceClient()

// `!` здесь НЕТ намеренно: ключей может не быть, и это штатное состояние
// на проекте, где SMS-канал ещё не заведён. Невыполнимое обещание лучше
// назвать честно, чем уронить функцию при старте.
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_PHONE')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'Content-Type': 'application/json',
}

/** Срок жизни кода. */
const OTP_TTL_MINUTES = 10
/** Сколько ждать между двумя запросами кода. */
const RESEND_COOLDOWN_SECONDS = 60
/** Сколько неверных вводов подряд допускается, прежде чем код сгорает. */
const MAX_ATTEMPTS = 5

const fail = (code: string, status = 400) =>
  new Response(JSON.stringify({ error: code }), { status, headers: CORS })

const ok = (body: Record<string, unknown> = { ok: true }) =>
  new Response(JSON.stringify(body), { headers: CORS })

/**
 * E.164 и ничего кроме: плюс, код страны, до пятнадцати цифр.
 *
 * Проверка нужна не ради красоты. Без неё в колонку уходила любая строка,
 * а Twilio отвечал отказом уже ПОСЛЕ того, как номер записан, — и человек
 * оставался с мусором в профиле и со снятым подтверждением.
 */
const E164 = /^\+[1-9]\d{6,14}$/

/**
 * Номер для показа владельцу: видны начало и две последние цифры.
 *
 * Полный номер не отдаётся никому, включая самого владельца: колонка
 * `phone` закрыта от клиента миграцией 14, и открывать её обратно ради
 * удобства значило бы вернуть то, что закрывали. Владельцу нужно узнать
 * СВОЙ номер, а не прочитать его — для этого хватает хвоста.
 */
const maskPhone = (phone: string): string => {
  if (phone.length < 5) return '•••'
  const head = phone.slice(0, 3)
  const tail = phone.slice(-2)
  const hidden = '•'.repeat(Math.max(2, phone.length - 5))
  return `${head}${hidden}${tail}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()

  // Раньше здесь 401 отдавался без CORS-заголовков — из браузера это выглядело
  // как сетевая ошибка, а не как «нужен вход».
  const user = await getUserFromAuthHeader(req)
  if (user instanceof Response) return user

  let body: { action?: string; phone?: string; otp?: string }
  try {
    body = await req.json()
  } catch {
    return fail('bad_request')
  }
  const { action, phone, otp } = body

  // ───────────────────────────────────────────────────────────────────
  // Что на руках у владельца.
  //
  // Отдельное действие нужно потому, что колонка `phone` клиенту не
  // читается ВООБЩЕ (401 из PostgREST, замерено 21.09). Без этого ответа
  // профиль не мог бы показать даже «номер на месте» — только предлагать
  // ввести его заново при каждом заходе.
  if (action === 'status') {
    const { data, error } = await supabase
      .from('users')
      .select('phone, phone_verified')
      .eq('id', user.id)
      .single()

    if (error) return fail('internal_error', 500)

    return ok({
      phone: data?.phone ? maskPhone(data.phone) : null,
      verified: Boolean(data?.phone_verified),
    })
  }

  // ───────────────────────────────────────────────────────────────────
  // Выдача кода.
  if (action === 'send') {
    if (typeof phone !== 'string' || !E164.test(phone)) return fail('phone_invalid')

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      // Канал не заведён. Это не ошибка человека и не сбой — и сказано это
      // должно быть отдельным словом, а не пересказом чужого отказа.
      return fail('sms_not_configured', 503)
    }

    const { data: current, error: readError } = await supabase
      .from('users')
      .select('phone, phone_verified, phone_otp, phone_otp_expires_at')
      .eq('id', user.id)
      .single()

    if (readError) return fail('internal_error', 500)

    // Повторная отправка не чаще раза в минуту. Кнопка без ограничения —
    // это бесплатная рассылка SMS за счёт владельца проекта.
    if (current?.phone_otp && current.phone_otp_expires_at) {
      const issuedAt = new Date(current.phone_otp_expires_at).getTime() - OTP_TTL_MINUTES * 60_000
      if (Date.now() - issuedAt < RESEND_COOLDOWN_SECONDS * 1000) {
        return fail('code_recently_sent', 429)
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString()

    // СМЕНА НОМЕРА СНИМАЕТ ПОДТВЕРЖДЕНИЕ. Иначе значок «téléphone vérifié»
    // остаётся висеть на номере, который никто не проверял.
    const phoneChanged = current?.phone !== phone

    const { error: writeError } = await supabase.from('users').update({
      phone,
      phone_otp: code,
      phone_otp_expires_at: expires,
      phone_otp_attempts: 0,
      ...(phoneChanged ? { phone_verified: false } : {}),
    }).eq('id', user.id)

    if (writeError) return fail('update_failed', 500)

    const params = new URLSearchParams({
      From: TWILIO_FROM,
      To: phone,
      Body: `RentIt: ${code}`,
    })

    let twilioRes: Response
    try {
      twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        },
      )
    } catch {
      return fail('sms_send_failed', 502)
    }

    if (!twilioRes.ok) {
      // Ответ провайдера — в лог, а не человеку: он на английском и
      // говорит о внутренностях Twilio.
      console.error('[verify-phone] twilio отказал:', twilioRes.status, await twilioRes.text())
      return fail('sms_send_failed', 502)
    }

    return ok({ expiresInMinutes: OTP_TTL_MINUTES })
  }

  // ───────────────────────────────────────────────────────────────────
  // Проверка кода.
  if (action === 'verify') {
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return fail('code_incorrect')

    const { data, error } = await supabase
      .from('users')
      .select('phone_otp, phone_otp_expires_at, phone_otp_attempts')
      .eq('id', user.id)
      .single()

    if (error) return fail('internal_error', 500)
    if (!data?.phone_otp) return fail('no_code_requested')

    if (new Date() > new Date(data.phone_otp_expires_at)) return fail('code_expired')

    // Перебор. Шесть цифр за десять минут скрипт успевает пощупать
    // достаточно раз, чтобы второй фактор перестал быть фактором.
    if ((data.phone_otp_attempts ?? 0) >= MAX_ATTEMPTS) return fail('too_many_attempts', 429)

    if (data.phone_otp !== otp) {
      await supabase.from('users')
        .update({ phone_otp_attempts: (data.phone_otp_attempts ?? 0) + 1 })
        .eq('id', user.id)
      return fail('code_incorrect')
    }

    const { error: confirmError } = await supabase.from('users').update({
      phone_verified: true,
      phone_otp: null,
      phone_otp_expires_at: null,
      phone_otp_attempts: 0,
    }).eq('id', user.id)

    if (confirmError) return fail('update_failed', 500)

    return ok()
  }

  return fail('bad_request')
})
