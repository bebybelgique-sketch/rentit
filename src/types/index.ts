// src/types/database.types.ts
// Это пример структуры, которая будет представлять вашу Supabase базу данных
interface Database {
  public: {
    Tables: {
      items: {
        Row: {
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
        };
        Insert: {};
        Update: {};
      };
      rentals: {
        Row: {
          id: string;
          item_id: string;
          renter_id: string;
          start_date: string;
          end_date: string;
          total_price: number;
          status: 'pending' | 'approved' | 'rejected' | 'completed' | 'canceled';
          message?: string;
          created_at: string;
        };
        Insert: {};
        Update: {};
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          bio?: string;
        };
        Insert: {};
        Update: {};
      };
    };
    Enums: {
      // Здесь будут перечисления из вашей базы данных
    };
  }
}
// Этот файл будет содержать типы, сгенерированные на основе вашей Supabase базы данных
// Пример структуры, которая может быть заполнена автоматически:
declare global {
  type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
  type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
}

// Оставьте этот экспорт, чтобы сделать файл модулем
export {};
import { Tables } from './supabase'; // Импортируем, если файл supabase.ts будет сгенерирован

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
  // Добавьте другие поля, если необходимо, или используйте тип из supabase.ts
}

// Тип для Rental. Может быть заменен на Tables<'rentals'>['Row'] из supabase.ts
export interface Rental {
  id: string;
  item_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'canceled'; // Пример статусов
  message?: string;
  created_at: string;
  // Добавьте другие поля, если необходимо, или используйте тип из supabase.ts
  // Также может включать вложенный объект item, если он возвращается из Supabase
  item?: Item;
}

// Тип для Profile. Может быть заменен на Tables<'profiles'>['Row'] из supabase.ts
export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio?: string;
  // Другие поля профиля
}

// Если файл supabase.ts содержит эквивалентные типы, их можно экспортировать напрямую:
// export type { Item as SupabaseItem, Rental as SupabaseRental, Profile as SupabaseProfile } from './supabase';