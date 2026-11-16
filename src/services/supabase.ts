// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawEnvUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawEnvKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const supabaseUrl = rawEnvUrl.replace(/\/+$/, '');
export const supabaseAnonKey = rawEnvKey;

/**
 * Checks whether a token is a standard 3-part JWT (`eyJ...`).
 * Modern Supabase publishable keys (`sb_publishable_...`) are opaque keys, NOT JWTs.
 * Passing `Authorization: Bearer sb_publishable_...` causes Supabase API Gateway to reject
 * the request with `401 This endpoint requires a valid Bearer token`.
 */
export function isSupabaseJwtToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  return clean.split('.').length === 3 && clean.startsWith('eyJ');
}

/**
 * Builds headers for direct browser `fetch()` calls to Supabase REST/Auth endpoints,
 * compatible with both classic `eyJ...` anon JWTs and modern `sb_publishable_...` keys.
 */
export function buildSupabasePublicHeaders(
  accessToken?: string | null,
  extraHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
    ...extraHeaders,
  };
  const candidate = (accessToken || supabaseAnonKey || '').trim();
  if (isSupabaseJwtToken(candidate)) {
    headers.Authorization = `Bearer ${candidate.replace(/^Bearer\s+/i, '').trim()}`;
  }
  return headers;
}

const supabaseCompatibleFetch: typeof fetch = async (input, init) => {
  const nextHeaders = new Headers(init?.headers || {});
  const authVal =
    nextHeaders.get('Authorization') || nextHeaders.get('authorization');
  if (authVal && !isSupabaseJwtToken(authVal)) {
    nextHeaders.delete('Authorization');
    nextHeaders.delete('authorization');
  }
  if (supabaseAnonKey && !nextHeaders.has('apikey')) {
    nextHeaders.set('apikey', supabaseAnonKey);
  }
  return fetch(input, {
    ...init,
    headers: nextHeaders,
  });
};

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
    global: {
      fetch: supabaseCompatibleFetch,
    },
  });
}

export const supabase = createSupabaseClient();
