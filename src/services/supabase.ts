// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ljcweaeirwttqoygeoxd.supabase.co';
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqY3dlYWVpcnd0dHFveWdlb3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzA0MjUsImV4cCI6MjA5NTIwNjQyNX0.fa1AsIt3qcv24GvUz6Jzup7G_BUwvB4OKPzhQYYvOes';

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
