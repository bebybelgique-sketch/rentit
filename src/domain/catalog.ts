// src/domain/catalog.ts
//
// ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ для справочников предметной области.
//
// Опись 12.08 нашла шесть независимых объявлений категорий (Home, ListItem,
// EditItem, ItemDetail, MyItems, CategoriesSection) плюс три словаря. Три из
// них уже разошлись, и расхождения видел человек:
//
//   • power_tools — ⚡ на витрине и 🔌 на странице вещи;
//   • garden      — «Jardinage» везде и «Jardin & Extérieur» на лендинге;
//   • measuring   — «Mesure & Détection» везде и «Mesure» на лендинге.
//
// Плюс фантомы: MyItems знал категории `tools` и `other`, которых в продукте
// нет и никогда не было.
//
// То же с состоянием вещи (три одинаковые копии — пока одинаковые) и со
// статусами брони (две карты подписей, три несовпадения: Actif/En cours,
// Rejeté/Refusé, En attente d'approbation/En attente).
//
// Правило простое: здесь лежит СТРУКТУРА (какие значения существуют, какой
// ключ подписи), ТЕКСТ живёт в словарях, а ОФОРМЛЕНИЕ — в компонентах.
// Копия структуры в странице — это будущее расхождение, а не удобство.
//
// А состав значений, которые приходят ИЗ БАЗЫ, здесь больше не объявляется:
// он импортируется из схемы (src/types → database.types.ts) и закреплён за
// таблицами ниже через `satisfies` и проверку исчерпываемости. Справочник
// отвечает на вопрос «какая подпись и какой тон у значения», а не «какие
// значения существуют» — на него отвечает база.

import type { BookingStatusValue, ItemConditionValue } from '../types'

/* ─────────────────────────── Категории ─────────────────────────── */

// hintKey — примеры инструментов, нужны лендингу. Раньше он держал их у себя
// вместе со своей копией названий, и названия разошлись: «Jardin & Extérieur»
// против «Jardinage», «Mesure» против «Mesure & Détection».
// Поля `emoji` здесь больше нет. Оно было ОФОРМЛЕНИЕМ в справочнике
// СТРУКТУРЫ — и держало продукт на двух визуальных языках сразу: лендинг
// после #12 рисовал категории SVG-иконками, а витрина, страница вещи и
// «Мои инструменты» продолжали ставить ⚡🔧🌿. Человек видел смену языка
// на первом же переходе с лендинга.
// Иконки живут в `src/components/icons/CategoryIcon.tsx`, ключи те же.
export const CATEGORIES = [
  { value: 'power_tools',  labelKey: 'categories.power_tools',  hintKey: 'categoryHints.power_tools',  priceHintKey: 'categoryPrices.power_tools'  },
  { value: 'hand_tools',   labelKey: 'categories.hand_tools',   hintKey: 'categoryHints.hand_tools',   priceHintKey: 'categoryPrices.hand_tools'   },
  { value: 'garden',       labelKey: 'categories.garden',       hintKey: 'categoryHints.garden',       priceHintKey: 'categoryPrices.garden'       },
  { value: 'construction', labelKey: 'categories.construction', hintKey: 'categoryHints.construction', priceHintKey: 'categoryPrices.construction' },
  { value: 'cleaning',     labelKey: 'categories.cleaning',     hintKey: 'categoryHints.cleaning',     priceHintKey: 'categoryPrices.cleaning'     },
  { value: 'measuring',    labelKey: 'categories.measuring',    hintKey: 'categoryHints.measuring',    priceHintKey: 'categoryPrices.measuring'    },
] as const

export type CategoryValue = (typeof CATEGORIES)[number]['value']

export const CATEGORY_VALUES: readonly string[] = CATEGORIES.map(c => c.value)

const CATEGORY_BY_VALUE = new Map(CATEGORIES.map(c => [c.value as string, c]))

/** Ключ подписи для словаря. */
export function categoryLabelKey(value: string | null | undefined): string | null {
  return (value && CATEGORY_BY_VALUE.get(value)?.labelKey) || null
}

/** Ключ подсказки о ценах — для формы выкладки. */
export function categoryPriceHintKey(value: string | null | undefined): string | null {
  return (value && CATEGORY_BY_VALUE.get(value)?.priceHintKey) || null
}

/**
 * Значение пришло из адресной строки или из базы — проверяем, что такая
 * категория существует. Без этого `?category=logement` тихо отфильтрует
 * витрину в ноль и будет выглядеть как «ничего не нашлось».
 */
export function isCategoryValue(value: string | null | undefined): value is CategoryValue {
  return !!value && CATEGORY_BY_VALUE.has(value)
}

/* ──────────────────────── Состояние вещи ───────────────────────── */

// `satisfies` оставляет тип literals (значения читаются как 'new', а не
// string) и одновременно проверяет их по схеме: опечатка в значении или
// удаление enum'а в базе ломает сборку здесь, а не показывает пустую подпись.
export const CONDITIONS = [
  { value: 'new',      labelKey: 'conditions.new'      },
  { value: 'like_new', labelKey: 'conditions.like_new' },
  { value: 'good',     labelKey: 'conditions.good'     },
  { value: 'fair',     labelKey: 'conditions.fair'     },
] as const satisfies readonly { value: ItemConditionValue; labelKey: string }[]

export type ConditionValue = (typeof CONDITIONS)[number]['value']

/**
 * Значения enum'а, которым НЕ досталось подписи. Пустое множество — и это
 * проверяется на уровне типов: `AssertEmpty` не примет ничего, кроме `never`.
 * Появится в базе пятое состояние — сборка встанет здесь с именем значения,
 * а не покажет человеку код вместо подписи.
 */
export type UncoveredConditionValue = Exclude<ItemConditionValue, ConditionValue>
type AssertEmpty<T extends never> = T
export type ConditionTableCoversEnum = AssertEmpty<UncoveredConditionValue>

const CONDITION_BY_VALUE = new Map(CONDITIONS.map(c => [c.value as string, c]))

export function conditionLabelKey(value: string | null | undefined): string | null {
  return (value && CONDITION_BY_VALUE.get(value)?.labelKey) || null
}

/* ───────────────────────── Статусы брони ───────────────────────── */

/**
 * Порядок и цвет — часть смысла: оранжевый ждёт решения, зелёный
 * подтверждён, синий идёт, серый закончен, красный не состоялся.
 *
 * Статусы `pending_payment`, `payment_expired` и `disputed` оставлены в
 * списке НАМЕРЕННО, хотя ни одна функция их сегодня не ставит: строка в базе
 * с таким значением может прийти из прошлого, и показать её кодом вместо
 * подписи было бы хуже. Их недостижимость описана в
 * docs/diagrams/booking-state-machine.html.
 */
export const BOOKING_STATUSES = [
  { value: 'pending_approval', labelKey: 'status.pending_approval', tone: 'orange' },
  { value: 'pending_payment',  labelKey: 'status.pending_payment',  tone: 'orange' },
  { value: 'confirmed',        labelKey: 'status.confirmed',        tone: 'green'  },
  { value: 'active',           labelKey: 'status.active',           tone: 'blue'   },
  { value: 'completed',        labelKey: 'status.completed',        tone: 'gray'   },
  { value: 'cancelled',        labelKey: 'status.cancelled',        tone: 'red'    },
  { value: 'rejected',         labelKey: 'status.rejected',         tone: 'red'    },
  { value: 'expired',          labelKey: 'status.expired',          tone: 'gray'   },
  { value: 'payment_expired',  labelKey: 'status.payment_expired',  tone: 'gray'   },
  { value: 'disputed',         labelKey: 'status.disputed',         tone: 'purple' },
] as const satisfies readonly BookingStatusEntry[]

/**
 * Тон бейджа — закрытый список, хотя это и оформление: «серый» однажды
 * становится «grey», и один статус из десяти уезжает в другой цвет. Объявлен
 * ДО таблицы, чтобы `satisfies` мог на него сослаться; выводить его из самой
 * таблицы значило бы проверять таблицу самой собой.
 */
export const STATUS_TONES = ['orange', 'green', 'blue', 'gray', 'red', 'purple'] as const
export type StatusTone = (typeof STATUS_TONES)[number]

interface BookingStatusEntry {
  value: BookingStatusValue
  labelKey: string
  tone: StatusTone
}

/**
 * Значения enum'а без подписи. Должно быть пусто — и это не пожелание, а
 * проверка типов: `AssertEmpty` объявлен выше и не принимает ничего, кроме
 * `never`.
 *
 * ЗАЧЕМ. До 06.09 `BookingStatusValue` объявлялся ЗДЕСЬ — выводом из этой же
 * таблицы. Наборы с enum'ом базы совпадали (те же десять значений), но связи
 * между ними не было никакой: новое значение в `public.booking_status`
 * компилировалось молча, а бейдж показывал бы его кодом. Второй экспорт того
 * же имени из `src/types` делал расхождение вопросом времени.
 */
export type UncoveredBookingStatus = Exclude<BookingStatusValue, (typeof BOOKING_STATUSES)[number]['value']>
export type BookingStatusTableCoversEnum = AssertEmpty<UncoveredBookingStatus>

const STATUS_BY_VALUE = new Map(BOOKING_STATUSES.map(s => [s.value as string, s]))

export function statusLabelKey(value: string | null | undefined): string | null {
  return (value && STATUS_BY_VALUE.get(value)?.labelKey) || null
}

/**
 * Проверка принадлежности к enum booking_status. Нужна там, где статус
 * приходит строкой из чужих рук (ответ функции, колбэк компонента) и
 * укладывается в типизированную строку брони: без проверки на этом месте
 * стоял бы `as`, то есть обещание компилятору вместо знания.
 */
export function isBookingStatus(value: string | null | undefined): value is BookingStatusValue {
  return !!value && STATUS_BY_VALUE.has(value)
}

export function statusTone(value: string | null | undefined): StatusTone | null {
  return (value && STATUS_BY_VALUE.get(value)?.tone) || null
}
