// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawEnvUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawEnvKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const supabaseUrl = rawEnvUrl.replace(/\/+$/, '');
export const supabaseAnonKey = rawEnvKey;

function createSupabaseClient(): SupabaseClient {
  const url = supabaseUrl || 'https://placeholder.supabase.co';
  const key = supabaseAnonKey || 'placeholder-key';
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== 'undefined',
      lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
        return await fn();
      },
    },
  });
}

export const supabase = createSupabaseClient();
