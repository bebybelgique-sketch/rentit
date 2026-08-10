// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    '[RentIt] Missing VITE_SUPABASE_URL environment variable. ' +
    'Please add it to your .env file. See README.md for instructions.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '[RentIt] Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
    'Please add it to your .env file. See README.md for instructions.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)