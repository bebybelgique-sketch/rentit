// Здесь был выдуманный интерфейс Database с таблицами `rentals` и `profiles`.
// Таких таблиц в базе НЕТ (проверено обращением к живой базе 10.08.2026:
// оба имени отдают 404). Настоящие: items, bookings, users, reviews, payments,
// events. Блок удалён, чтобы он больше никого не вводил в заблуждение.

// src/types/supabase.ts пока заглушка (одни комментарии), поэтому импорта из него нет.

// Определяем типы, которые могут быть переопределены или расширены сгенерированными типами
// Если файл supabase.ts пуст или не содержит нужных типов, используются эти.

// Тип для Item. Может быть заменен на Tables<'items'>['Row'] из supabase.ts
export interface Item {
  id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  image_url: string;
  owner_id: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  is_available: boolean;
  created_at: string;
  // Колонки, которые есть в таблице items и используются формами:
  deposit?: number;
  category?: string;
  condition?: string;
  photos?: string[];
}

// Тип для Rental. Может быть заменен на Tables<'rentals'>['Row'] из supabase.ts
export interface Rental {
  id: string;
  item_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  // Значения строго из enum booking_status в базе (сверено 10.08.2026)
  status: 'pending_approval' | 'pending_payment' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'disputed' | 'rejected' | 'expired' | 'payment_expired';
  message?: string;
  created_at: string;
  // Добавьте другие поля, если необходимо, или используйте тип из supabase.ts
  // Также может включать вложенный объект item, если он возвращается из Supabase
  item?: Item;
}

// Профиль = строка таблицы users (id совпадает с auth.uid()).
// Поля сверены со схемой 10.08.2026; поля bio в базе нет.
export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone?: string | null;
  village?: string | null;
}

// Если файл supabase.ts содержит эквивалентные типы, их можно экспортировать напрямую:
// export type { Item as SupabaseItem, Rental as SupabaseRental, Profile as SupabaseProfile } from './supabase';