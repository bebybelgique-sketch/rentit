// supabase/functions/_shared/types.ts

/**
 * Типы для схемы базы данных RentIt
 */

// Enum для статуса бронирования
export type BookingStatus =
  | 'pending_approval'
  | 'pending_payment'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'rejected'
  | 'expired'
  | 'payment_expired';

// Тип для пользователя
export interface User {
  id: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  phone_verified: boolean;
  village?: string;
  lat?: number;
  lng?: number;
  role?: string;
  referral_code?: string;
  referred_by?: string;
  rating_as_owner?: number;
  rating_as_renter?: number;
  created_at: string;
}

// Тип для вещи (item)
export interface Item {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  category: string;
  condition: string;
  price_per_day: number;
  deposit: number;
  photos?: string[]; // jsonb
  lat?: number;
  lng?: number;
  address?: string;
  available: boolean;
  created_at: string;
}

// Тип для бронирования (booking)
export interface Booking {
  id: string;
  item_id: string;
  renter_id: string;
  start_date: string; // ISO string
  end_date: string; // ISO string
  total_days: number; // generated
  total_price: number;
  deposit_amount: number;
  platform_fee: number;
  status: BookingStatus;
  amount_paid: number;
  stripe_payment_intent_id?: string;
  deposit_returned: boolean;
  created_at: string;
}