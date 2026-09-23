// Доставка push-уведомлений: кому, что и что делать с ответом службы.
//
// ── ГЛАВНОЕ ПРАВИЛО: НИКОГДА НЕ БРОСАТЬ ─────────────────────────────
//
// Уведомление идёт ПОСЛЕ того, как бронь записана, ответ дан, заявка
// истекла. Упасть здесь — значит сорвать ответ человеку на действие,
// которое на самом деле удалось. Поэтому любой исход — в лог, наружу —
// только отчёт.
//
// ── ЧТО ПИШЕТСЯ В ЛОГ, А ЧТО НЕТ ────────────────────────────────────
//
// Счёт и коды — да. Адреса подписок — нет: адрес службы это ключ, по
// которому можно слать человеку сообщения. Текст переписки — тоже нет:
// лог читают не те, кому его писали.
//
// ── ЗАВИСИМОСТИ ПАРАМЕТРАМИ ─────────────────────────────────────────
//
// База и ключи приходят снаружи. Так связку можно проверить в vitest без
// Supabase и без сети, а функция не может «случайно» взять чужие ключи.
//
// ── ЛЕНТА ПЕРВОЙ, PUSH ВТОРЫМ (с 23.09) ─────────────────────────────
//
// Каждое событие сначала записывается в ленту человека (таблица
// notifications, миграция 42), потом — push. Лента не зависит ни от
// ключей VAPID, ни от подписок: у отказавшихся от уведомлений и на iPhone
// без экрана «Домой» она — единственный след события. Вход — notifyUser.

import { sendWebPush, type PushOutcome, type PushTarget, type VapidKeys } from './webPush.ts'
import {
  renderPush, DELIVERY, bookingTag, bookingTopic, bookingUrl, isPushLang,
  type PushKind, type PushFacts, type PushLang,
} from './pushCopy.ts'
import { CONTACT_EMAIL } from './operator.ts'

export interface StoredSubscription extends PushTarget {
  readonly lang: string
}

export interface PushDeps {
  /** null — ключи VAPID не заведены. Это состояние, а не ошибка. */
  readonly vapid: VapidKeys | null
  readonly listSubscriptions: (userId: string) => Promise<StoredSubscription[]>
  readonly removeSubscription: (endpoint: string) => Promise<void>
  /** Для проверки. В проде — настоящая отправка. */
  readonly send?: (target: PushTarget, payload: unknown, vapid: VapidKeys, opts: Parameters<typeof sendWebPush>[3]) => Promise<PushOutcome>
  /**
   * Запись в ленту. Повтор того же события — не ошибка: ограничение
   * notifications_once отвечает 23505, и запись просто не удваивается.
   */
  readonly recordActivity?: (entry: ActivityEntry) => Promise<void>
  readonly log?: (line: string) => void
}

/** Строка ленты. Текста нет — он собирается при показе (миграция 42). */
export interface ActivityEntry {
  readonly userId: string
  readonly kind: PushKind
  readonly bookingId: string
  readonly messageId: string | null
}

/**
 * События, которые идут ТОЛЬКО в ленту. Отмену пакет Design в push не
 * включил — это его решение; а в ленте она нужна (см. pushCopy.ts).
 */
export const FEED_ONLY: ReadonlySet<PushKind> = new Set<PushKind>(['cancelled'])

export interface PushReport {
  readonly skipped?: 'not_configured' | 'no_subscriptions' | 'error' | 'feed_only'
  readonly sent: number
  readonly gone: number
  readonly failed: number
}

/** Что уходит в браузер. Воркер показывает это как есть. */
export interface PushPayload {
  readonly title: string
  readonly body: string
  readonly tag: string
  readonly url: string
  readonly lang: PushLang
}

/**
 * Ключи из окружения функции.
 *
 * `sub` — контакт для службы уведомлений: по нему Google, Apple и Mozilla
 * пишут, если с нашими сообщениями что-то не так. Адрес берётся из
 * operator.ts — того же места, что юридические страницы и письма.
 */
export function vapidFromEnv(): VapidKeys | null {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env
  const publicKey = env?.get('VAPID_PUBLIC_KEY')
  const privateKey = env?.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: `mailto:${CONTACT_EMAIL}` }
}

/** Зависимости поверх клиента Supabase с ролью service_role. */
// deno-lint-ignore no-explicit-any
export function supabaseDeps(supabase: any, vapid = vapidFromEnv()): PushDeps {
  return {
    vapid,
    listSubscriptions: async (userId) => {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth, lang')
        .eq('user_id', userId)
      if (error) throw new Error(`push_subscriptions: ${error.message}`)
      return data ?? []
    },
    removeSubscription: async (endpoint) => {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    },
    recordActivity: async (entry) => {
      const { error } = await supabase.from('notifications').insert({
        user_id: entry.userId,
        kind: entry.kind,
        booking_id: entry.bookingId,
        message_id: entry.messageId,
      })
      // 23505 — это событие уже записано (повтор вызова). Итог тот же.
      if (error && error.code !== '23505') throw new Error(`notifications: ${error.message}`)
      // Срок хранения — 90 дней. Подчищаем у того, кому пишем: запрос по
      // индексу (user_id, created_at), и ручного шага «почистить» нет.
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', entry.userId)
        .lt('created_at', new Date(Date.now() - ACTIVITY_TTL_MS).toISOString())
    },
  }
}

/** Сколько живёт запись ленты. */
export const ACTIVITY_TTL_MS = 90 * 24 * 3600 * 1000

/**
 * Событие — человеку: запись в ленту, потом push. Не бросает.
 *
 * Лента пишется ВСЕГДА — и без ключей VAPID, и без подписок: в этом её
 * смысл. Неудача ленты не отменяет push, и наоборот: это два канала, а не
 * одна транзакция.
 */
export async function notifyUser(
  deps: PushDeps,
  userId: string | null | undefined,
  kind: PushKind,
  facts: PushFacts,
  bookingId: string,
  messageId: string | null = null,
): Promise<PushReport> {
  const log = deps.log ?? ((line: string) => console.log(line))
  if (!userId) return { skipped: 'no_subscriptions', sent: 0, gone: 0, failed: 0 }

  if (deps.recordActivity) {
    try {
      await deps.recordActivity({ userId, kind, bookingId, messageId })
    } catch (e) {
      log(`[activity] ${kind}: запись не удалась — ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (FEED_ONLY.has(kind)) return { skipped: 'feed_only', sent: 0, gone: 0, failed: 0 }
  return pushToUser(deps, userId, kind, facts, bookingId)
}

/** Отправить одно уведомление на все устройства человека. Не бросает. */
export async function pushToUser(
  deps: PushDeps,
  userId: string | null | undefined,
  kind: PushKind,
  facts: PushFacts,
  bookingId: string,
): Promise<PushReport> {
  const log = deps.log ?? ((line: string) => console.log(line))
  const label = `[push] ${kind}`

  if (!deps.vapid) {
    log(`${label}: ключи VAPID не заведены — не отправлено`)
    return { skipped: 'not_configured', sent: 0, gone: 0, failed: 0 }
  }
  if (!userId) {
    return { skipped: 'no_subscriptions', sent: 0, gone: 0, failed: 0 }
  }

  let subs: StoredSubscription[]
  try {
    subs = await deps.listSubscriptions(userId)
  } catch (e) {
    log(`${label}: подписки не прочитались — ${e instanceof Error ? e.message : String(e)}`)
    return { skipped: 'error', sent: 0, gone: 0, failed: 0 }
  }
  if (subs.length === 0) return { skipped: 'no_subscriptions', sent: 0, gone: 0, failed: 0 }

  const send = deps.send ?? sendWebPush
  const delivery = DELIVERY[kind]
  let sent = 0, gone = 0, failed = 0

  await Promise.all(subs.map(async (sub) => {
    // Язык — ЭТОГО устройства: на телефоне человек мог выбрать
    // нидерландский, на ноутбуке французский.
    const lang: PushLang = isPushLang(sub.lang) ? sub.lang : 'fr'
    const { title, body } = renderPush(kind, lang, facts)
    const payload: PushPayload = { title, body, tag: bookingTag(bookingId), url: bookingUrl(bookingId), lang }

    try {
      const outcome = await send(sub, payload, deps.vapid!, {
        ttl: delivery.ttl,
        urgency: delivery.urgency,
        topic: bookingTopic(bookingId),
      })
      if (outcome.kind === 'sent') {
        sent++
      } else if (outcome.kind === 'gone') {
        gone++
        // Подписки больше нет — убираем, иначе каждое событие будет
        // стучаться в закрытую дверь, а лог — полниться шумом.
        await deps.removeSubscription(sub.endpoint).catch(() => {})
      } else {
        failed++
        const detail = outcome.kind === 'rejected' ? `${outcome.status} ${outcome.detail}` : outcome.detail
        log(`${label}: служба отказала — ${detail}`)
      }
    } catch (e) {
      failed++
      log(`${label}: отправка упала — ${e instanceof Error ? e.message : String(e)}`)
    }
  }))

  log(`${label}: устройств ${subs.length} · доставлено ${sent} · снято ${gone} · отказов ${failed}`)
  return { sent, gone, failed }
}

// ── События брони → получатели ──────────────────────────────────────

/** Бронь в том виде, в каком её читает notify-rental. */
export interface BookingForPush {
  readonly id: string
  readonly renter_id: string
  readonly start_date: string | null
  readonly end_date: string | null
  readonly total_price: number | string | null
  readonly itemTitle: string | null
  readonly ownerId: string | null
  readonly ownerName: string | null
  readonly renterName: string | null
  /** Кто отменил — для события cancelled. */
  readonly cancelledBy?: string | null
}

/**
 * Кому что по событию. Таблица — из пакета Design:
 *
 *   заявка            → владелец
 *   принята           → арендатор
 *   отклонена         → арендатор
 *   истекла (24 ч)    → арендатор И владелец
 *
 * И одно событие сверх пакета — ТОЛЬКО В ЛЕНТУ, без push:
 *
 *   отменена          → вторая сторона (не тот, кто отменил)
 *
 * Остальные события броней не дают ни push, ни записи: выдачу и возврат
 * человек видит своими глазами, а «Рекламы нет никогда» распространяется
 * и на «ваша аренда началась».
 */
export async function pushForBookingEvent(deps: PushDeps, event: string, b: BookingForPush): Promise<void> {
  const facts: PushFacts = {
    itemTitle: b.itemTitle,
    ownerName: b.ownerName,
    otherName: b.renterName,
    startDate: b.start_date,
    endDate: b.end_date,
    totalPrice: b.total_price,
  }

  try {
    switch (event) {
      case 'pending_approval':
        await notifyUser(deps, b.ownerId, 'new_request', facts, b.id)
        return
      case 'approved':
        await notifyUser(deps, b.renter_id, 'accepted', facts, b.id)
        return
      case 'rejected':
        await notifyUser(deps, b.renter_id, 'declined', facts, b.id)
        return
      case 'expired':
        await Promise.all([
          notifyUser(deps, b.renter_id, 'expired_renter', facts, b.id),
          notifyUser(deps, b.ownerId, 'expired_owner', facts, b.id),
        ])
        return
      case 'cancelled': {
        // В тексте «{name} a annulé» имя — ОТМЕНИВШЕГО, а пишется запись
        // второй стороне. Кто отменил, неизвестно (так не бывает: отмену
        // проводит transition-booking и ставит cancelled_by) — узнают обе.
        const byRenter = b.cancelledBy === b.renter_id
        const byOwner = !!b.ownerId && b.cancelledBy === b.ownerId
        const cancelFacts: PushFacts = { ...facts, otherName: byOwner ? b.ownerName : b.renterName }
        if (byRenter) await notifyUser(deps, b.ownerId, 'cancelled', cancelFacts, b.id)
        else if (byOwner) await notifyUser(deps, b.renter_id, 'cancelled', cancelFacts, b.id)
        else {
          // Имени нет — запасное «un voisin»: иначе арендатор прочёл бы
          // своё же имя в «… a annulé».
          const anonymous: PushFacts = { ...facts, otherName: null }
          await Promise.all([
            notifyUser(deps, b.renter_id, 'cancelled', anonymous, b.id),
            notifyUser(deps, b.ownerId, 'cancelled', anonymous, b.id),
          ])
        }
        return
      }
      default:
        return
    }
  } catch (e) {
    // pushToUser сам не бросает; это страховка на случай, если однажды
    // начнёт. Бронь уже записана — ронять ответ из-за уведомления нельзя.
    console.error(`[push] ${event}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
