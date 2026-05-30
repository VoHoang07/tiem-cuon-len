// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

function createSupabaseClient(): SupabaseClient {
  const url = supabaseUrl || 'https://placeholder.supabase.co';
  const key = supabaseAnonKey || 'placeholder-key';
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
  });
}

export const supabase = createSupabaseClient();
