import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOwnerItems } from './useOwnerItems'
import { ownerTasks, type OwnerTask, type TaskBooking } from '../domain/ownerTasks'
import type { OwnerItem } from '../types'

/**
 * Дела владельца: что ждёт его хода прямо сейчас.
 *
 * ПОЧЕМУ БЕЗ СВОЕГО ЗАПРОСА. `useOwnerItems` уже тянет вещи ВМЕСТЕ с
 * бронями, и там есть всё нужное: статус, даты, время создания. Завести
 * здесь второй запрос значило бы получить две картины одних и тех же
 * строк, расходящиеся на время между ответами, — и показать «3» в значке
 * над списком из двух дел.
 *
 * Ключ кэша тот же (`itemKeys.asOwner`), поэтому на /my-items значок и
 * список берут ОДИН ответ, а не два. Мутации броней гасят этот ключ через
 * `invalidateBookingCaches`, то есть ответ на заявку убирает дело из
 * значка сам, без ручного шага.
 *
 * ЧТО СЧИТАЕТСЯ ДЕЛОМ — в src/domain/ownerTasks.ts. Здесь только сборка.
 */

export interface OwnerTaskWithItem {
  readonly task: OwnerTask
  readonly item: OwnerItem
  /** Бронь целиком — списку нужен арендатор и суммы, значку не нужно ничего. */
  readonly booking: OwnerItem['bookings'][number]
}

export interface OwnerTasksResult {
  readonly tasks: OwnerTaskWithItem[]
  /** Число для значка. Всегда равно длине списка — считается из него же. */
  readonly count: number
  readonly loading: boolean
}

/**
 * @param now Момент, от которого считается срочность. Передаётся ради
 *            проверяемости: набор не должен зависеть от часов процесса.
 */
export function useOwnerTasks(now: Date = new Date()): OwnerTasksResult {
  const { user } = useAuth()
  const { data: items, isLoading } = useOwnerItems(user?.id)

  // Момент округляется до минуты: иначе новый `new Date()` на каждом
  // рендере менял бы зависимость и пересчитывал список без причины.
  const minute = Math.floor(now.getTime() / 60_000)

  const tasks = useMemo<OwnerTaskWithItem[]>(() => {
    if (!items?.length) return []
    const at = new Date(minute * 60_000)

    // Дела — ПЛОСКИМ СПИСКОМ ПО ВСЕМ ВЕЩАМ, включая скрытые. Заявка на
    // скрытую вещь никуда не девается, и ответить на неё всё равно надо:
    // спрятать дело вместе с вещью значило бы потерять его молча.
    const byBooking = new Map<string, { item: OwnerItem; booking: OwnerItem['bookings'][number] }>()
    const bookings: TaskBooking[] = []

    for (const item of items) {
      for (const booking of item.bookings ?? []) {
        byBooking.set(booking.id, { item, booking })
        bookings.push({
          id: booking.id,
          status: booking.status ?? null,
          start_date: booking.start_date ?? null,
          end_date: booking.end_date ?? null,
          created_at: booking.created_at ?? null,
        })
      }
    }

    return ownerTasks(bookings, at)
      .map((task) => {
        const found = byBooking.get(task.bookingId)
        return found ? { task, item: found.item, booking: found.booking } : null
      })
      .filter((x): x is OwnerTaskWithItem => x !== null)
  }, [items, minute])

  return { tasks, count: tasks.length, loading: isLoading }
}
