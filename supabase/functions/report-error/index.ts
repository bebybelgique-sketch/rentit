import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createSupabaseServiceClient } from '../_shared/supabase.ts'
import { handleOPTIONS } from '../_shared/cors.ts'
import { json } from '../_shared/json.ts'
import { fingerprintOf, isNoise, parseReport } from '../_shared/clientErrors.ts'

// Приём отчёта о поломке из браузера.
//
// ── ПОЧЕМУ БЕЗ ВХОДА ─────────────────────────────────────────────────
//
// Поломка до входа — на витрине, на странице вещи, на самом входе — не
// менее важна, чем после. Поэтому звать может кто угодно с публичным
// ключом, и всё, что приходит, считается чужим: разбор, маски и обрезка —
// в _shared/clientErrors.ts, потолок и срок хранения — в самой базе
// (функция record_client_error, миграция 41).
//
// ── ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО ──────────────────────────────────────────
//
// Кто прислал. Ни user_id, ни IP в таблицу не пишутся: чинить поломку
// помогает «где и что», а не «у кого». Заголовок Authorization, если он
// есть, не читается вовсе.

/** Больше не бывает у настоящего отчёта: поля и так обрезаются до 3 КБ. */
const MAX_BODY = 16 * 1024

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOPTIONS()
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    // Длина — ДО разбора: мегабайт JSON стоит разобрать дороже, чем отказать.
    const text = await req.text()
    if (text.length > MAX_BODY) return json({ error: 'payload_too_large' }, 413)

    let raw: unknown = null
    try {
      raw = JSON.parse(text)
    } catch {
      return json({ error: 'bad_request' }, 400)
    }

    const report = parseReport(raw)
    // Шум (расширения браузера, «Script error.») — не ошибка запроса:
    // браузер честно прислал то, что поймал. Отвечаем «принято» без записи.
    if (!report) {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const noise = typeof r.message === 'string' && isNoise(r.message, typeof r.stack === 'string' ? r.stack : null)
      return noise ? json({ ok: true, status: 'ignored' }) : json({ error: 'bad_request' }, 400)
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.rpc('record_client_error', {
      p_fingerprint: await fingerprintOf(report),
      p_kind: report.kind,
      p_message: report.message,
      p_stack: report.stack,
      p_path: report.path,
      p_release: report.release,
      p_user_agent: report.userAgent,
      p_lang: report.lang,
    })
    if (error) {
      console.error('[report-error] запись:', error.message)
      return json({ error: 'internal_error' }, 500)
    }

    // new / repeat / capped. Сообщать это безопасно: личного здесь нет, а
    // проверить приём снаружи (npm run test:edge) иначе было бы нечем.
    return json({ ok: true, status: data })
  } catch (err) {
    console.error('[report-error]', err instanceof Error ? err.message : String(err))
    return json({ error: 'internal_error' }, 500)
  }
})
