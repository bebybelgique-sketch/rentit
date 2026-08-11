// supabase/functions/_shared/supabase.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export const createSupabaseServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};