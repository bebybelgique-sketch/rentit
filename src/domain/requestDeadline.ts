// src/domain/requestDeadline.ts
//
// Сколько осталось владельцу ответить на заявку.
//
// ОТКУДА СРОК. Его назначает не интерфейс, а планировщик:
// supabase/functions/expire-bookings переводит бронь в `expired`, когда
//
//     status = 'pending_approval'  И  created_at < now() - 24 часа
//
// Страница вещи обещает это арендатору вслух («Le propriétaire a 24 heures
// pour répondre»), а владелец до 20.09.2026 не видел срока НИГДЕ: заявка
// лежала в карточке вещи без единого намёка, что у неё есть конец.
//
// ПОЧЕМУ ОТДЕЛЬНЫМ МОДУЛЕМ. Число 24 существует в трёх местах: в кроне, в
// обещании арендатору и теперь здесь. Два первых — не наши, их менять
// нельзя мимоходом, поэтому константа названа и снабжена ссылкой: тот, кто
// захочет её тронуть, увидит, с чем именно она обязана совпасть.

/** Часы, которые крон даёт владельцу на ответ. Совпадает с expire-bookings. */
export const ANSWER_WINDOW_HOURS = 24

/**
 * Планировщик ходит раз в полчаса, поэтому фактическая отмена случается
 * ПОЗЖЕ срока, а не раньше. Значит остаток, посчитанный здесь, — нижняя
 * граница: владелец, успевший к показанному времени, успевает наверняка.
 * Обратное было бы опасно, и потому округление идёт ВНИЗ.
 */
export const CRON_PERIOD_MINUTES = 30

export type RequestDeadline =
  /** Срок вышел. Крон ещё не отработал, но заявка уже не жилец. */
  | { state: 'overdue' }
  /** Меньше часа: считаем минутами, иначе «0 ч» читается как «времени нет». */
  | { state: 'minutes'; minutes: number }
  /** Час и больше. */
  | { state: 'hours'; hours: number }

/**
 * Остаток по `created_at` заявки.
 *
 * `now` передаётся, а не берётся изнутри: функция обязана быть проверяемой
 * без подмены часов процесса.
 */
export const answerDeadline = (createdAt: string | null, now: Date): RequestDeadline => {
  // Без даты создания срок неизвестен. Показывать «осталось 24 ч» было бы
  // выдумкой: отсчёт идёт не от сейчас, а от момента, которого мы не знаем.
  if (!createdAt) return { state: 'overdue' }

  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return { state: 'overdue' }

  const deadline = created.getTime() + ANSWER_WINDOW_HOURS * 60 * 60 * 1000
  const leftMs = deadline - now.getTime()

  if (leftMs <= 0) return { state: 'overdue' }

  const leftMinutes = Math.floor(leftMs / 60000)
  // Ровно час показываем часами, меньше — минутами. «0 ч» не появляется
  // никогда: это худшая из подписей, потому что читается как «уже поздно»,
  // хотя время ещё есть.
  if (leftMinutes < 60) return { state: 'minutes', minutes: Math.max(1, leftMinutes) }

  return { state: 'hours', hours: Math.floor(leftMinutes / 60) }
}

/**
 * Заявка горит, если осталось меньше трёх часов.
 *
 * Порог выбран не по красоте: три часа — это шесть заходов планировщика,
 * то есть запас на то, что человек посмотрит экран не сию секунду. Признак
 * нужен, чтобы срочное отличалось ВИДОМ, а не только числом: список из
 * восьми заявок глазами по числам не читают.
 */
export const isUrgent = (d: RequestDeadline): boolean =>
  d.state === 'overdue' || d.state === 'minutes' || (d.state === 'hours' && d.hours < 3)
