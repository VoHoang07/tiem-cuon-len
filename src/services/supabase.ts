// Supabase client
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) {
    console.warn(
      '⚠️ Supabase chưa được cấu hình.\n' +
      'Tạo file .env với:\n' +
      'EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key'
    );
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
