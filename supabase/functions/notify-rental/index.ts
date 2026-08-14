import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SITE_URL } from '../_shared/operator.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
// Восклицательного знака здесь больше нет намеренно. Он означал «клянусь,
// переменная задана» — а 12.08 `npx supabase secrets list` показал девять
// секретов, и RESEND_API_KEY среди них НЕ БЫЛО. Ключ уходил в заголовок
// как `Bearer undefined`, Resend отвечал 401, и никто об этом не узнавал.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
// Умолчания больше не указывают на rentit.app: этот домен НАМ НЕ
// ПРИНАДЛЕЖИТ. Каждая ссылка в каждом письме вела к чужому человеку, а
// отправитель на неподтверждённом домене получил бы от Resend 403 —
// то есть даже с появившимся ключом письма бы не пошли.
// SITE_URL — общая точка с юридическими страницами (_shared/operator.ts),
// чтобы адрес продукта нельзя было поменять в одном месте и забыть в другом.
// FROM_EMAIL остаётся обязательным секретом: молча подставить отправителя
// значило бы решить за Рамзана, с какого адреса пишет продукт.
const FROM_EMAIL = Deno.env.get('FROM_EMAIL')
const APP_URL = Deno.env.get('APP_URL') || SITE_URL

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version' }

/**
 * Отправка письма через Resend.
 *
 * Было: `await fetch(...)` и всё. Ни `response.ok`, ни `try/catch`, ни
 * строчки в лог. Resend мог ответить 401 на неверный ключ, 403 на
 * неподтверждённый домен, 422 на плохой адрес, 429 на лимит — функция
 * возвращала успех при любом исходе. Вызывающие её `await`-или и получали
 * 200. Провал не всплывал НИГДЕ.
 *
 * Цена этой тишины прямая: сосед оставляет запрос на аренду, владелец не
 * получает письма, оба видят «всё прошло», и площадка молча умирает для
 * обоих. Ровно то, чего боялись.
 *
 * Теперь ошибка бросается наружу: письмо — не побочный эффект, а часть
 * обещания «вам придёт уведомление». Бронь при этом не теряется: тот, кто
 * зовёт notify-rental, гасит её падение своим `.catch()`, и запись в базе
 * уже создана.
 */
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY не задан в секретах проекта — письма не отправляются')
  }
  if (!FROM_EMAIL) {
    throw new Error('FROM_EMAIL не задан в секретах проекта — с какого адреса писать, продукт не знает')
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })

  if (!res.ok) {
    // Тело ответа Resend называет причину поимённо: неподтверждённый
    // домен, неверный адрес, превышенный лимит. Без него в логе остаётся
    // голый код, по которому чинить нечего.
    const body = await res.text().catch(() => '')
    console.error(`Resend ${res.status} при отправке «${subject}» на ${to}: ${body.slice(0, 300)}`)
    throw new Error(`Resend ответил ${res.status}`)
  }

  console.log(`письмо отправлено: «${subject}» → ${to}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Only service role
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  try {
    const { booking_id, event } = await req.json()

    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        items(id, title, price_per_day, owner_id, users!owner_id(full_name, phone)),
        users!renter_id(full_name, phone)
      `)
      .eq('id', booking_id)
      .single()

    if (!booking) return new Response('Booking not found', { status: 404, headers: CORS })

    const item = booking.items as any
    const renter = booking.users as any
    const owner = item?.users as any

    const { data: ownerAuth } = await supabase.auth.admin.getUserById(item?.owner_id || '')
    const { data: renterAuth } = await supabase.auth.admin.getUserById(booking.renter_id)

    const ownerEmail = ownerAuth?.user?.email
    const renterEmail = renterAuth?.user?.email

    const myItemsLink = `${APP_URL}/my-items`
    const myRentalsLink = `${APP_URL}/my-rentals`
    // payLink больше не нужен: оплаты в платформе нет

    // --- NEW: Owner receives rental request ---
    if (event === 'pending_approval') {
      if (ownerEmail) {
        await sendEmail(ownerEmail, `Nouvelle demande de location : ${item?.title}`, `
          <h2>Vous avez une nouvelle demande de location</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Demandeur : <strong>${renter?.full_name}</strong></p>
          <p>Dates : ${booking.start_date} → ${booking.end_date} (${booking.total_days} jour${booking.total_days !== 1 ? 's' : ''})</p>
          <p>Prix de location : €${Number(booking.total_price).toFixed(2)}</p>
          ${booking.request_message ? `<p>Message : <em>"${booking.request_message}"</em></p>` : ''}
          <p><strong>Vous avez 24 heures pour répondre.</strong> Passé ce délai, la demande sera automatiquement annulée.</p>
          <p><a href="${myItemsLink}" style="background:#080808;color:#F2F0EB;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;margin-top:8px;">Répondre à la demande</a></p>
        `)
      }
    }

    // --- Renter approved: réservation confirmée, paiement en espèces ---
    if (event === 'approved') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Réservation confirmée — ${item?.title}`, `
          <h2>Votre réservation est confirmée</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Dates : ${booking.start_date} → ${booking.end_date} (${booking.total_days} jour${booking.total_days !== 1 ? 's' : ''})</p>
          <p>Montant convenu : €${Number(booking.total_price).toFixed(2)}${booking.deposit_amount > 0 ? ` + €${Number(booking.deposit_amount).toFixed(2)} de caution` : ''}</p>
          <p><strong>Le règlement se fait en espèces, directement au propriétaire, lors de la remise de l'article.</strong> RentIt ne perçoit aucun paiement et ne prélève aucune commission.</p>
          <p>Convenez ensemble du lieu et de l'heure de la remise. Pensez à rendre l'article dans l'état où vous l'avez reçu — la caution vous sera restituée à la restitution.</p>
          <p>Propriétaire : <strong>${owner?.full_name || '—'}</strong>${owner?.phone ? ` · ${owner.phone}` : ''}</p>
          <p><a href="${APP_URL}/my-rentals" style="background:#080808;color:#F2F0EB;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;margin-top:8px;">Voir ma réservation</a></p>
        `)
      }
      // Le propriétaire reçoit les coordonnées du locataire : sans cela,
      // aucune remise en main propre n'est possible.
      if (ownerEmail) {
        await sendEmail(ownerEmail, `Réservation confirmée — ${item?.title}`, `
          <h2>Vous avez accepté cette demande</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Locataire : <strong>${renter?.full_name || '—'}</strong>${renter?.phone ? ` · ${renter.phone}` : ''}</p>
          <p>Dates : ${booking.start_date} → ${booking.end_date} (${booking.total_days} jour${booking.total_days !== 1 ? 's' : ''})</p>
          <p>Montant convenu : €${Number(booking.total_price).toFixed(2)}${booking.deposit_amount > 0 ? ` + €${Number(booking.deposit_amount).toFixed(2)} de caution` : ''}, à percevoir <strong>en espèces</strong> lors de la remise.</p>
          <p><a href="${myItemsLink}">Gérer mes annonces</a></p>
        `)
      }
    }

    // --- NEW: Renter rejected ---
    if (event === 'rejected') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Demande refusée : ${item?.title}`, `
          <h2>Votre demande de location a été refusée</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Dates demandées : ${booking.start_date} → ${booking.end_date}</p>
          <p>Le propriétaire ne peut pas honorer cette demande. Vous pouvez chercher d'autres outils disponibles.</p>
          <p><a href="${APP_URL}/browse">Parcourir les outils disponibles</a></p>
        `)
      }
    }

    // --- NEW: Owner didn't respond in 24h ---
    if (event === 'expired') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Demande expirée : ${item?.title}`, `
          <h2>Votre demande de location a expiré</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Dates demandées : ${booking.start_date} → ${booking.end_date}</p>
          <p>Le propriétaire n'a pas répondu dans les 24 heures. La demande a été annulée automatiquement.</p>
          <p><a href="${APP_URL}/browse">Parcourir les outils disponibles</a></p>
        `)
      }
    }

    // --- NEW: Renter didn't pay in 2h after approval ---
    if (event === 'payment_expired') {
      if (ownerEmail) {
        await sendEmail(ownerEmail, `Paiement non reçu : ${item?.title}`, `
          <h2>Le locataire n'a pas finalisé le paiement</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Locataire : <strong>${renter?.full_name}</strong></p>
          <p>Dates : ${booking.start_date} → ${booking.end_date}</p>
          <p>Le locataire n'a pas payé dans le délai de 2 heures. Ces dates sont à nouveau disponibles.</p>
          <p><a href="${myItemsLink}">Gérer mes annonces</a></p>
        `)
      }
    }

    // --- EXISTING: Payment confirmed ---
    if (event === 'confirmed') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Réservation confirmée : ${item?.title}`, `
          <h2>Votre location est confirmée !</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Dates : ${booking.start_date} → ${booking.end_date} (${booking.total_days} jour${booking.total_days !== 1 ? 's' : ''})</p>
          <p>Total payé : €${(booking.amount_paid / 100).toFixed(2)}</p>
          ${owner?.phone ? `<p>Téléphone du propriétaire : <strong>${owner.phone}</strong></p>` : ''}
          <p><a href="${myRentalsLink}">Voir mes locations</a></p>
        `)
      }
      if (ownerEmail) {
        await sendEmail(ownerEmail, `Nouvelle location confirmée : ${item?.title}`, `
          <h2>Votre outil a été loué !</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Locataire : <strong>${renter?.full_name}</strong></p>
          <p>Dates : ${booking.start_date} → ${booking.end_date} (${booking.total_days} jour${booking.total_days !== 1 ? 's' : ''})</p>
          <p>Revenu de location : €${Number(booking.total_price).toFixed(2)}</p>
          <p><a href="${myItemsLink}">Gérer mes annonces</a></p>
        `)
      }
    }

    if (event === 'cancelled') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Location annulée : ${item?.title}`, `
          <h2>Votre location a été annulée</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Dates : ${booking.start_date} → ${booking.end_date}</p>
          <p>Si vous avez payé, vous recevrez un remboursement complet.</p>
          <p><a href="${APP_URL}/browse">Parcourir les outils</a></p>
        `)
      }
    }

    if (event === 'active') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Location démarrée : ${item?.title}`, `
          <h2>La période de location a commencé</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>À retourner avant le : <strong>${booking.end_date}</strong></p>
          <p>Votre caution de €${booking.deposit_amount} sera remboursée après le retour de l'outil.</p>
        `)
      }
    }

    if (event === 'completed') {
      if (renterEmail) {
        await sendEmail(renterEmail, `Location terminée : ${item?.title}`, `
          <h2>Location terminée — merci !</h2>
          <p>Article : <strong>${item?.title}</strong></p>
          <p>Votre caution de €${booking.deposit_amount} sera remboursée prochainement.</p>
          <p>Laisser un avis : <a href="${APP_URL}/item/${booking.item_id}">Évaluer cet outil</a></p>
        `)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    // Функцию зовёт только сервисная роль (проверка токена выше), поэтому
    // причина здесь не утечка наружу, а единственный способ увидеть, что
    // письма не уходят. В логах Supabase она же лежит развёрнуто.
    console.error('notify-rental:', err)
    return new Response(JSON.stringify({ error: err?.message ?? 'notify failed' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
