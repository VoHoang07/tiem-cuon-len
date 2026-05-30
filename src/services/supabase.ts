// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function parseSupabaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const url = raw?.trim();
  if (!url || !url.startsWith('https://')) {
    return '';
  }
  return url;
}

function parseSupabaseAnonKey(): string {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return key || '';
}

const supabaseUrl = parseSupabaseUrl();
const supabaseAnonKey = parseSupabaseAnonKey();
const isConfigured = supabaseUrl !== '' && supabaseAnonKey !== '';

if (!isConfigured) {
  if (__DEV__) {
    console.warn(
      '⚠️ Supabase chưa được cấu hình.\n' +
      'Tạo file .env với:\n' +
      'EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key'
    );
  }
}

if (__DEV__ && isConfigured) {
  console.log('[SUPABASE URL]', supabaseUrl);
}

function createSupabaseClient(): SupabaseClient {
  if (!isConfigured) {
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

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
  });
}

export const supabase = createSupabaseClient();
