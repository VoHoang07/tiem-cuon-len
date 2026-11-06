// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawEnvUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const rawEnvKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const isLegacyRestrictedProject =
  rawEnvUrl.includes('ljcweaeirwttqoygeoxd') ||
  rawEnvKey.includes('bGpjd2VhZWlyd3R0cW95Z2VveGQ');

export const supabaseUrl =
  !rawEnvUrl || isLegacyRestrictedProject
    ? 'https://ajxvqewsqvfdpovkqqqw.supabase.co'
    : rawEnvUrl;
export const supabaseAnonKey =
  !rawEnvKey || isLegacyRestrictedProject
    ? 'sb_publishable_g3xVNQbOj0PyTj9NrCpDyw_6hmDGWab'
    : rawEnvKey;

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
