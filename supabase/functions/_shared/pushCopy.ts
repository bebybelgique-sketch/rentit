// Тексты push-уведомлений — на языке ПОЛУЧАТЕЛЯ.
//
// ── ОТКУДА ТЕКСТЫ ───────────────────────────────────────────────────
//
// Дословно из пакета Claude Design «Rentit Push Permission»
// (handoff/push-permission.md, 22.09.2026), с ОДНИМ отступлением,
// записанным ниже у события `accepted`.
//
// Нидерландские строки Design пометил как свои и просил показать
// носителю языка. Это не сделано — они ждут проверки.
//
// ── ПОЧЕМУ ТЕКСТЫ ЗДЕСЬ, А НЕ В src/locales ─────────────────────────
//
// Уведомление собирает СЕРВЕР: на экране блокировки браузер показывает
// ровно то, что пришло, и ни словари приложения, ни выбранный язык там
// недоступны. Язык берётся из подписки — его записывает устройство,
// когда подписывается и когда человек переключает язык.
//
// Это тот же случай, что тексты писем в notify-rental: содержимое,
// которое сервер отправляет наружу, живёт рядом с отправкой.

export type PushLang = 'fr' | 'nl' | 'en'
export const PUSH_LANGS: readonly PushLang[] = ['fr', 'nl', 'en']

export const isPushLang = (value: unknown): value is PushLang =>
  typeof value === 'string' && (PUSH_LANGS as readonly string[]).includes(value)

export type PushKind =
  | 'new_request'
  | 'accepted'
  | 'declined'
  | 'expired_renter'
  | 'expired_owner'
  | 'new_message'

export const PUSH_KINDS: readonly PushKind[] = [
  'new_request', 'accepted', 'declined', 'expired_renter', 'expired_owner', 'new_message',
]

interface Copy {
  readonly title: string
  readonly body: string
}

/**
 * ОТСТУПЛЕНИЕ ОТ ПАКЕТА — событие `accepted`.
 *
 * В пакете: «{item}, {dates}. Ouvrez pour voir son numéro.» — «откройте,
 * чтобы увидеть его номер». Продукт номер НЕ ПОКАЗЫВАЕТ никому: колонки
 * phone закрыты миграцией 20260811000014, кнопку WhatsApp, светившую
 * чужой номер, сняли, а связь после принятия идёт перепиской внутри
 * брони. Человек открыл бы приложение, номера не нашёл и решил бы, что
 * его обманули. Уведомление обещает то, что продукт делает, а не то,
 * что хотелось бы.
 *
 * Замена повторяет слова, которыми продукт УЖЕ зовёт договориться в самой
 * переписке (booking.messagesEmpty): «Convenez ici du lieu et de
 * l'heure» / «Spreek hier plaats en tijd af» / «Agree on place and time
 * here». Обещание в уведомлении совпадает с тем, что человек увидит,
 * открыв его.
 *
 * Если продукт однажды начнёт показывать номер после принятия — это
 * отдельное решение по данным, и тогда вернуть исходную строку.
 */
const COPY: Record<PushLang, Record<PushKind, Copy>> = {
  fr: {
    new_request: {
      title: 'Demande pour « {item} »',
      body: '{name} · {dates} · {total}. Répondez sous 24 h.',
    },
    accepted: {
      title: '{owner} a accepté',
      body: "{item}, {dates}. Ouvrez pour convenir du lieu et de l'heure.",
    },
    declined: {
      title: '{owner} a refusé',
      body: "{item}, {dates}. Vos coordonnées n'ont pas été transmises.",
    },
    expired_renter: {
      title: 'Pas de réponse de {owner}',
      body: "« {item} » : la demande a expiré après 24 h. Rien n'a été transmis.",
    },
    expired_owner: {
      title: 'Demande expirée',
      body: "{name} n'a pas eu de réponse pour « {item} ». L'outil est de nouveau libre.",
    },
    new_message: {
      title: '{name} · nouveau message',
      body: '{preview}',
    },
  },
  nl: {
    new_request: {
      title: 'Aanvraag voor „{item}"',
      body: '{name} · {dates} · {total}. Antwoord binnen 24 u.',
    },
    accepted: {
      title: '{owner} heeft aanvaard',
      body: '{item}, {dates}. Open de app om plaats en tijd af te spreken.',
    },
    declined: {
      title: '{owner} heeft geweigerd',
      body: '{item}, {dates}. Je gegevens zijn niet doorgegeven.',
    },
    expired_renter: {
      title: 'Geen antwoord van {owner}',
      body: '„{item}": de aanvraag is na 24 u vervallen. Er is niets doorgegeven.',
    },
    expired_owner: {
      title: 'Aanvraag vervallen',
      body: '{name} kreeg geen antwoord voor „{item}". Het gereedschap is weer vrij.',
    },
    new_message: {
      title: '{name} · nieuw bericht',
      body: '{preview}',
    },
  },
  en: {
    new_request: {
      title: 'Request for "{item}"',
      body: '{name} · {dates} · {total}. Reply within 24 h.',
    },
    accepted: {
      title: '{owner} accepted',
      body: '{item}, {dates}. Open to agree on place and time.',
    },
    declined: {
      title: '{owner} declined',
      body: "{item}, {dates}. Your details weren't shared.",
    },
    expired_renter: {
      title: 'No reply from {owner}',
      body: '"{item}": the request expired after 24 h. Nothing was shared.',
    },
    expired_owner: {
      title: 'Request expired',
      body: '{name} got no reply for "{item}". The tool is free again.',
    },
    new_message: {
      title: '{name} · new message',
      body: '{preview}',
    },
  },
}

/**
 * Имя пустое — такое бывает: `full_name not null default ''`.
 *
 * Запасное слово подобрано так, чтобы вставать в ЛЮБОЙ шаблон
 * грамматично: «votre voisin a accepté» и «pas de réponse de votre
 * voisin». В начале фразы первая буква становится заглавной — только у
 * запасного слова, пользовательский текст не трогается.
 */
const FALLBACK: Record<PushLang, { owner: string; name: string; item: string }> = {
  fr: { owner: 'votre voisin', name: 'un voisin', item: "l'outil" },
  nl: { owner: 'je buur', name: 'een buur', item: 'het gereedschap' },
  en: { owner: 'your neighbour', name: 'a neighbour', item: 'the tool' },
}

const MONTHS: Record<PushLang, readonly string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  nl: ['jan.', 'feb.', 'mrt.', 'apr.', 'mei', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// ── Подстановки — правила из пакета ─────────────────────────────────

/** Сколько знаков названия вещи. Из пакета: «{item} tronqué à 32». */
export const ITEM_MAX = 32
/** Сколько знаков превью. Из пакета: «90 premiers caractères». */
export const PREVIEW_MAX = 90
/** Чем закрывается скрытое. Одинаково на всех языках. */
export const MASK = '•••'

/** Обрезка по ЗНАКАМ, а не по кодовым единицам: эмодзи не рвётся пополам. */
const cut = (text: string, max: number): string => {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  return chars.slice(0, max - 1).join('').trimEnd() + '…'
}

/** «Ramzan Bekov» → «Ramzan B.». Пустое → null, чтобы сработал запасной вариант. */
export function shortName(fullName: string | null | undefined): string | null {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  const initial = Array.from(parts[parts.length - 1])[0]?.toUpperCase() ?? ''
  return `${parts[0]} ${initial}.`
}

export const shortItem = (title: string | null | undefined): string | null => {
  const t = (title ?? '').trim()
  return t ? cut(t, ITEM_MAX) : null
}

const parseDay = (iso: string | null | undefined): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * «20 → 21 sept.» — как в пакете.
 *
 * Своя таблица месяцев вместо Intl: что лежит в ICU среды Supabase, я не
 * проверял, а текст на экране блокировки обязан выходить одинаковым
 * всюду. Даты — календарные дни без времени; часовые пояса их не
 * касаются.
 */
export function dateRange(start: string | null | undefined, end: string | null | undefined, lang: PushLang): string | null {
  const a = parseDay(start)
  const b = parseDay(end) ?? a
  if (!a || !b) return null
  const [ya, ma, da] = a
  const [yb, mb, db] = b
  const m = MONTHS[lang]
  if (ya === yb && ma === mb && da === db) return `${da} ${m[ma - 1]}`
  if (ya === yb && ma === mb) return `${da} → ${db} ${m[mb - 1]}`
  if (ya === yb) return `${da} ${m[ma - 1]} → ${db} ${m[mb - 1]}`
  return `${da} ${m[ma - 1]} ${ya} → ${db} ${m[mb - 1]} ${yb}`
}

/** «€45» или «€45.50» — как цены в самом продукте. */
export function money(amount: number | string | null | undefined): string | null {
  const n = Number(amount)
  if (amount === null || amount === undefined || !Number.isFinite(n)) return null
  return Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2)}`
}

/**
 * Телефоны и почтовые адреса — скрыть.
 *
 * Правило пакета: «никогда не показывать номер — экран блокировки
 * публичен». В переписке люди пишут номера постоянно («appelle-moi au
 * 0475…»), поэтому превью без маски было бы прямой утечкой.
 *
 * ТЕЛЕФОН — 9 цифр и больше, с разделителями между ними. Порог выбран не
 * наугад: бельгийский стационарный номер — 9 цифр, мобильный — 10, а дата
 * «20/09/2026» — только 8. Поэтому дата уцелеет, а номер нет. IBAN
 * попадает под то же правило, и это к лучшему.
 *
 * ПОЧТУ пакет не называл. Скрываю по той же причине, что и номер: адрес
 * на экране блокировки так же публичен.
 */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/g
const PHONE = /(?:\+|00)?\d(?:[\s.\-/()]{0,3}\d){8,}/g

export function maskSensitive(text: string): string {
  return text.replace(EMAIL, MASK).replace(PHONE, MASK)
}

/** Превью сообщения: сначала маска, потом обрезка — номер не режется пополам. */
export function preview(body: string | null | undefined): string {
  const masked = maskSensitive(body ?? '').replace(/\s+/g, ' ').trim()
  return cut(masked, PREVIEW_MAX)
}

// ── Сборка ──────────────────────────────────────────────────────────

/** Что известно о событии. Сервер заполняет из брони и сообщения. */
export interface PushFacts {
  readonly itemTitle?: string | null
  readonly ownerName?: string | null
  /** Для заявки и истечения — арендатор; для сообщения — отправитель. */
  readonly otherName?: string | null
  readonly startDate?: string | null
  readonly endDate?: string | null
  readonly totalPrice?: number | string | null
  readonly messageBody?: string | null
}

export interface RenderedPush {
  readonly title: string
  readonly body: string
}

const capitalizeFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export function renderPush(kind: PushKind, lang: PushLang, facts: PushFacts): RenderedPush {
  const fb = FALLBACK[lang]
  const owner = shortName(facts.ownerName)
  const name = shortName(facts.otherName)
  const item = shortItem(facts.itemTitle)

  const values: Record<string, { value: string; fallback: boolean }> = {
    owner: owner ? { value: owner, fallback: false } : { value: fb.owner, fallback: true },
    name: name ? { value: name, fallback: false } : { value: fb.name, fallback: true },
    item: item ? { value: item, fallback: false } : { value: fb.item, fallback: true },
    dates: { value: dateRange(facts.startDate, facts.endDate, lang) ?? '—', fallback: false },
    total: { value: money(facts.totalPrice) ?? '—', fallback: false },
    preview: { value: preview(facts.messageBody), fallback: false },
  }

  const fill = (template: string) => {
    // Точка сокращения служит и точкой предложения. «20 → 21 sept.» в
    // шаблоне «{dates}. Ouvrez…» давало «sept.. Ouvrez» — две точки
    // подряд, во французском и нидерландском. Снимаем ТОЛЬКО точку
    // шаблона после подстановки, уже кончающейся точкой; многоточие в
    // чужом сообщении не трогается.
    const tpl = template.replace(/\{(\w+)\}\./g, (whole, key: string) =>
      values[key]?.value.endsWith('.') ? `{${key}}` : whole)
    let out = tpl.replace(/\{(\w+)\}/g, (whole, key: string) => values[key]?.value ?? whole)
    // Запасное слово в начале фразы — с заглавной. Только оно: название
    // вещи и имя человека остаются в том виде, в каком их написали.
    const lead = /^\{(\w+)\}/.exec(template)?.[1]
    if (lead && values[lead]?.fallback) out = capitalizeFirst(out)
    return out
  }

  const copy = COPY[lang][kind]
  return { title: fill(copy.title), body: fill(copy.body) }
}

/**
 * Как долго служба держит сообщение для устройства вне сети и насколько
 * оно срочное. Новая заявка и сообщение — срочные: у заявки сутки на
 * ответ, а сообщение обычно ждут сейчас.
 */
export const DELIVERY: Record<PushKind, { ttl: number; urgency: 'normal' | 'high' }> = {
  new_request: { ttl: 24 * 3600, urgency: 'high' },
  accepted: { ttl: 3 * 24 * 3600, urgency: 'normal' },
  declined: { ttl: 24 * 3600, urgency: 'normal' },
  expired_renter: { ttl: 24 * 3600, urgency: 'normal' },
  expired_owner: { ttl: 24 * 3600, urgency: 'normal' },
  new_message: { ttl: 24 * 3600, urgency: 'high' },
}

/**
 * Одна бронь — одно место на экране. Из пакета: `tag: booking-{id}`.
 * Тема для службы — тот же id без дефисов: ровно 32 знака, предел RFC.
 */
export const bookingTag = (bookingId: string) => `booking-${bookingId}`
export const bookingTopic = (bookingId: string) => bookingId.replace(/-/g, '').slice(0, 32)

/**
 * Куда ведёт нажатие. В пакете — `/bookings/{id}`, такого маршрута в
 * продукте нет. Ссылка на конкретную бронь уже существует: /my-rentals с
 * параметром booking, и сторону (арендатор или владелец) экран определяет
 * сам. Второй адрес того же экрана был бы вторым местом, где это решают.
 */
export const bookingUrl = (bookingId: string) => `/my-rentals?booking=${encodeURIComponent(bookingId)}`
