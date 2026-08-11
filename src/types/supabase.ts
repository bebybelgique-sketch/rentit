// src/types/supabase.ts
// Этот файл должен быть заполнен типами, сгенерированными из вашей Supabase базы данных.
// Выполните команду в терминале: npx supabase gen types typescript --project-id <ваш-id> --schema public > src/types/supabase.ts
// Пример возможного содержимого (структура будет зависеть от вашей схемы):
/*
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          price_per_day: number
          deposit: number
          category: string
          condition: string
          photos: string[] | null
          lat: number | null
          lng: number | null
          address: string | null
          available: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description?: string | null
          price_per_day: number
          deposit: number
          category: string
          condition: string
          photos?: string[] | null
          lat?: number | null
          lng?: number | null
          address?: string | null
          available?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string | null
          price_per_day?: number
          deposit?: number
          category?: string
          condition?: string
          photos?: string[] | null
          lat?: number | null
          lng?: number | null
          address?: string | null
          available?: boolean
          created_at?: string
        }
      }
      // ... другие таблицы
    }
    // ... другие разделы, такие как Enums, Functions, Views
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
*/