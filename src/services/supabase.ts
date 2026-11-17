// Supabase client
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawEnvUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawEnvKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

function normalizeSupabaseBaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage|functions|realtime)\/v1$/i, '')
    .replace(/\/+$/, '');
}

export const supabaseUrl = normalizeSupabaseBaseUrl(rawEnvUrl);
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

let cachedDeviceBridgeJwt: string | null = null;

const supabaseCompatibleFetch: typeof fetch = async (input, init) => {
  const nextHeaders = new Headers(init?.headers || {});
  const authVal =
    nextHeaders.get('Authorization') || nextHeaders.get('authorization');
  if (authVal && !isSupabaseJwtToken(authVal)) {
    nextHeaders.delete('Authorization');
    nextHeaders.delete('authorization');
  }
  const urlStr = typeof input === 'string' ? input : (input as Request)?.url || '';
  if (
    !nextHeaders.has('Authorization') &&
    cachedDeviceBridgeJwt &&
    isSupabaseJwtToken(cachedDeviceBridgeJwt) &&
    urlStr.includes('/rest/v1/')
  ) {
    nextHeaders.set('Authorization', `Bearer ${cachedDeviceBridgeJwt}`);
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

const CLIENT_ADMIN_EMAILS = new Set([
  'tiemcuonlen@gmail.com',
  'vohoang1327@gmail.com',
  'khanhly30072007@gmail.com',
]);

let inFlightBridgePromise: Promise<string | null> | null = null;

/**
 * Ensures the browser holds a valid, non-expired GoTrue JWT (or auto-bridges a cached user
 * across a Supabase project migration) and attaches any verified OAuth headers (`X-OAuth-Token`).
 */
export async function ensureClientSupabaseAuthHeaders(
  extraHeaders: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...extraHeaders,
  };

  if (typeof window === 'undefined') return headers;

  // 1. Attach stored OAuth token if present in sessionStorage or localStorage
  try {
    const rawOAuth =
      (window.sessionStorage && window.sessionStorage.getItem('tcl_last_oauth_token_v1')) ||
      (window.localStorage && window.localStorage.getItem('tcl_last_oauth_token_v1'));
    if (rawOAuth) {
      const parsedOAuth = JSON.parse(rawOAuth);
      if (parsedOAuth?.token && parsedOAuth?.provider) {
        headers['X-OAuth-Token'] = String(parsedOAuth.token).trim();
        headers['X-OAuth-Provider'] = String(parsedOAuth.provider).trim();
      }
    }
  } catch {
    // ignore
  }

  // 2. Check active Supabase GoTrue session
  try {
    const { data } = await supabase.auth.getSession();
    let session = data?.session || null;
    if (session?.expires_at && session.expires_at * 1000 - Date.now() < 60000) {
      const refreshed = await supabase.auth.refreshSession().catch(() => null);
      if (refreshed?.data?.session) {
        session = refreshed.data.session;
      }
    }

    if (session?.access_token && isSupabaseJwtToken(session.access_token)) {
      const email = String(session.user?.email || '').toLowerCase().trim();
      if (
        CLIENT_ADMIN_EMAILS.has(email) &&
        session.user?.user_metadata?.role !== 'admin'
      ) {
        await supabase.auth
          .updateUser({ data: { role: 'admin' } })
          .then(() => supabase.auth.refreshSession())
          .then((r) => {
            if (r?.data?.session?.access_token) {
              session = r.data.session;
            }
          })
          .catch(() => {});
      }
      headers.Authorization = `Bearer ${session.access_token}`;
      return headers;
    }
  } catch {
    // fall through to cached user bridge
  }

  // 3. Auto-bridge cached user (`tcl_cached_auth_user_v1`) when migrating across Supabase projects
  if (!inFlightBridgePromise) {
    inFlightBridgePromise = (async (): Promise<string | null> => {
      try {
        if (!window.localStorage) return null;
        const rawCached = window.localStorage.getItem('tcl_cached_auth_user_v1');
        if (!rawCached) return null;
        const cachedUser = JSON.parse(rawCached);
        const email = String(cachedUser?.email || '').toLowerCase().trim();
        const rawId = String(cachedUser?.id || '').trim();
        if (!email || !rawId) return null;

        const isAdmin = CLIENT_ADMIN_EMAILS.has(email);
        const displayName = String(
          cachedUser?.name || (isAdmin ? 'Quản trị viên' : email.split('@')[0])
        );

        // Extract Google `sub` if an older `sb-*-auth-token` exists in localStorage
        let legacyGoogleSub = rawId.startsWith('google_') ? rawId.slice(7) : '';
        if (!legacyGoogleSub) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
              try {
                const oldSess = JSON.parse(window.localStorage.getItem(k) || '{}');
                const idents = oldSess?.user?.identities;
                if (Array.isArray(idents) && idents[0]?.id) {
                  legacyGoogleSub = String(idents[0].id);
                  break;
                }
              } catch {
                // ignore
              }
            }
          }
        }

        const candidatePasswords = [
          ...(legacyGoogleSub
            ? [`TclOAuth#google_${legacyGoogleSub.slice(0, 14)}_2026!`]
            : []),
          `TclBridge#${rawId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14)}_2026!`,
        ];

        for (const pwd of candidatePasswords) {
          const signInRes = await supabase.auth
            .signInWithPassword({ email, password: pwd })
            .catch(() => null);
          if (signInRes?.data?.session?.access_token) {
            return signInRes.data.session.access_token;
          }
        }

        const primaryPwd = candidatePasswords[0];
        const signUpRes = await supabase.auth
          .signUp({
            email,
            password: primaryPwd,
            options: {
              data: {
                name: displayName,
                full_name: displayName,
                role: isAdmin ? 'admin' : 'customer',
                avatar: 'capybara',
              },
            },
          })
          .catch(() => null);
        if (signUpRes?.data?.session?.access_token) {
          return signUpRes.data.session.access_token;
        }

        // Last resort if primary email was registered with another password on a different device:
        // Obtain a lightweight REST JWT without mutating `supabase.auth` user state
        if (cachedDeviceBridgeJwt && isSupabaseJwtToken(cachedDeviceBridgeJwt)) {
          return cachedDeviceBridgeJwt;
        }
        const cleanDevId = rawId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 14) || 'user';
        const devEmail = `dev_${cleanDevId}@session.tiemcuonlen.shop`;
        const devPwd = `TclDev#${cleanDevId}_2026!`;
        if (supabaseUrl && supabaseAnonKey) {
          const tokRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: devEmail, password: devPwd }),
          }).catch(() => null);
          if (tokRes?.ok) {
            const tokJson = await tokRes.json().catch(() => ({}));
            if (tokJson?.access_token && isSupabaseJwtToken(tokJson.access_token)) {
              cachedDeviceBridgeJwt = String(tokJson.access_token);
              return cachedDeviceBridgeJwt;
            }
          }
          const supRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: devEmail,
              password: devPwd,
              data: {
                name: displayName,
                role: isAdmin ? 'admin' : 'customer',
              },
            }),
          }).catch(() => null);
          if (supRes?.ok) {
            const supJson = await supRes.json().catch(() => ({}));
            const tok = supJson?.access_token || supJson?.session?.access_token || '';
            if (tok && isSupabaseJwtToken(tok)) {
              cachedDeviceBridgeJwt = String(tok);
              return cachedDeviceBridgeJwt;
            }
          }
        }
        return null;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          inFlightBridgePromise = null;
        }, 2000);
      }
    })();
  }

  const bridgedToken = await inFlightBridgePromise;
  if (bridgedToken && isSupabaseJwtToken(bridgedToken)) {
    headers.Authorization = `Bearer ${bridgedToken}`;
  }
  return headers;
}
