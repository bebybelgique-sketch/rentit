import type { SupabaseClient } from '@supabase/supabase-js'

export const LIVE_BOOKING_STATUSES: readonly string[]

export function closeLiveBookings(
  client: SupabaseClient,
  itemIds: string[],
): Promise<{ found: number; closed: number; failures: string[] }>

export function removeTestItems(
  client: SupabaseClient,
  itemIds: string[],
): Promise<{ remaining: number; failures: string[] }>
