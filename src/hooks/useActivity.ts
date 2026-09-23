// src/hooks/useActivity.ts
//
// Лента событий человека (таблица notifications, миграция 42): чтение,
// счётчик непрочитанного и отметка «прочитано».
//
// Права — в самой базе, а не здесь: RLS отдаёт только свои строки, а
// менять клиенту можно ТОЛЬКО read_at (колоночный грант). Поэтому фильтра
// по user_id в запросах чтения нет — дублировать правило в клиенте значит
// завести второй источник истины. В UPDATE он есть: пустой фильтр
// PostgREST бы отверг, а «все мои» — это и есть user_id.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { activityKeys } from '../lib/queryKeys'
import type { ActivityRow } from '../domain/activity'

/** Больше в ленте не показываем: за 90 дней хранения — с запасом. */
const FEED_LIMIT = 100

const FEED_SELECT = `
  id, kind, booking_id, message_id, created_at, read_at,
  booking:bookings!booking_id(
    start_date, end_date, total_price, renter_id, cancelled_by,
    item:items(title, owner:users!owner_id(full_name)),
    renter:users!renter_id(full_name)
  ),
  message:booking_messages!message_id(body, sender:users!sender_id(full_name))
`

export const useActivityFeed = (userId: string | undefined) =>
  useQuery<ActivityRow[], Error>({
    queryKey: activityKeys.feed(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(FEED_SELECT)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)
      if (error) throw error
      return (data ?? []) as unknown as ActivityRow[]
    },
    enabled: !!userId,
  })

export interface UnreadActivity {
  readonly count: number
  /** Брони, у которых есть непрочитанное, — для меток в «Mes locations». */
  readonly bookingIds: ReadonlySet<string>
}

const EMPTY: UnreadActivity = { count: 0, bookingIds: new Set() }

/**
 * Непрочитанное: число для колокольчика и брони для меток. Один запрос на
 * оба — по частичному индексу (user_id) WHERE read_at IS NULL.
 *
 * Обновляется при возвращении на вкладку и раз в минуту: пришедший push
 * сверх того гасит ключ сразу (usePushSync, сообщение воркера).
 */
export const useUnreadActivity = (userId: string | undefined) =>
  useQuery<UnreadActivity, Error>({
    queryKey: activityKeys.unread(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('booking_id')
        .is('read_at', null)
        .limit(500)
      if (error) throw error
      const rows = (data ?? []) as Array<{ booking_id: string }>
      return { count: rows.length, bookingIds: new Set(rows.map((r) => r.booking_id)) }
    },
    enabled: !!userId,
    placeholderData: EMPTY,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

/**
 * «Прочитано»: всё сразу или всё по одной брони. Уже прочитанное не
 * трогается — дата первого прочтения остаётся честной.
 */
export const useMarkActivityRead = (userId: string | undefined) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (scope: { bookingId: string } | { all: true }) => {
      if (!userId) return
      let query = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
      if ('bookingId' in scope) query = query.eq('booking_id', scope.bookingId)
      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.all })
    },
    // Сбой отметки — не событие для человека: счётчик останется прежним,
    // и следующая попытка сделает то же самое. Глобальный тост мутаций
    // (App.tsx) здесь только мешал бы.
    onError: (error) => console.warn('[activity] отметка не удалась:', error),
  })
}
