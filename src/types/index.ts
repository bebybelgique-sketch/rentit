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

// Краткая карточка человека — то, что одна сторона сделки вправе знать о
// другой: как зовут, как выглядит, как его оценивали. Телефон и почта сюда
// не входят: договариваются стороны в переписке по броне.
export interface PartyProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  rating_as_owner?: number | null;
  rating_as_renter?: number | null;
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
  // Столбец в базе называется request_message. Поля message в bookings нет
  // и не было: страница выводила `rental.message` и показывала пустоту.
  request_message?: string | null;
  created_at: string;
  // Отмена: кто, когда и почему (миграция 20260811000011).
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  // Вещь приходит под псевдонимом item (в запросе: `item:items(...)`),
  // вместе с профилем владельца — иначе арендатор не знает, к кому едет.
  item?: Item & { owner?: PartyProfile | null };
  // Вторая сторона сделки в списке владельца.
  renter?: PartyProfile | null;
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