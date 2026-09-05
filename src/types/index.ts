import type { Database } from './database.types';

export type BookingStatusValue = Database['public']['Enums']['booking_status'];

export type ItemRow = Database['public']['Tables']['items']['Row'];
export type RentalRow = Database['public']['Tables']['bookings']['Row'];
export type ProfileRow = Database['public']['Tables']['users']['Row'];

export type Item = {
  id: string;
  owner_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  price_per_day?: number | null;
  price_3days?: number | null;
  price_week?: number | null;
  deposit?: number | null;
  late_fee_per_day?: number | null;
  photos: unknown;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  location?: unknown;
  available?: boolean | null;
  quantity?: number | null;
  buffer_days?: number | null;
  min_notice_days?: number | null;
  delivery_fee?: number | null;
  delivery_radius_km?: number | null;
  created_at?: string | null;
  is_business?: boolean | null;
  users?: {
   id: string;
   full_name: string | null;
   avatar_url: string | null;
   phone_verified?: boolean;
   rating_as_owner?: number | null;
   is_pro?: boolean;
  } | null;
  distance_m?: number | null;
};

export type Rental = {
  id: string;
  item_id?: string | null;
  renter_id?: string | null;
  status?: BookingStatusValue | null;
  start_date?: string | null;
  end_date?: string | null;
  total_price?: number | null;
  request_message?: string | null;
  created_at?: string | null;
  amount_paid?: number | null;
  approved_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  auto_closed_at?: string | null;
  delivery_fee?: number | null;
  delivery_requested?: boolean | null;
  deposit_amount?: number | null;
  insurance_amount?: number | null;
  platform_fee?: number | null;
  stripe_payment_intent_id?: string | null;
  total_days?: number | null;
  item?: (Item & {
   owner?: {
     id: string;
     full_name: string | null;
     avatar_url: string | null;
     rating_as_owner?: number | null;
   } | null;
  }) | null;
  renter?: {
   id: string;
   full_name: string | null;
   avatar_url: string | null;
   rating_as_renter?: number | null;
  } | null;
};

export type Profile = {
  id?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  village?: string | null;
};

export interface ItemBlackout {
  id: string;
  item_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
}

export interface PartyProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  rating_as_owner?: number | null;
  rating_as_renter?: number | null;
}
