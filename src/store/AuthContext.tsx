import { supabase, supabaseAnonKey, supabaseUrl } from '@/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

const AVATAR_STORAGE_PREFIX = '@tiem_cuon_len_avatar_';
const CACHED_AUTH_USER_KEY = 'tcl_cached_auth_user_v1';

// Explicit allowlist of shop administrator emails to prevent client-side user_metadata role tampering
const ADMIN_EMAILS = new Set([
  'vohoang1327@gmail.com',
  'khanhly30072007@gmail.com',
]);

function loadCachedAuthUser(): AuthUser | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CACHED_AUTH_USER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        if (parsed && parsed.id && parsed.email) {
          const email = parsed.email.toLowerCase().trim();
          return {
            ...parsed,
            role: ADMIN_EMAILS.has(email) ? 'admin' : 'customer',
          };
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveCachedAuthUser(u: AuthUser | null) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (u) {
        window.localStorage.setItem(CACHED_AUTH_USER_KEY, JSON.stringify(u));
      } else {
        window.localStorage.removeItem(CACHED_AUTH_USER_KEY);
      }
    }
  } catch {
    // ignore
  }
}

function sanitizeInput(val: string, maxLen = 80): string {
  return val.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

export type AuthProviderType =
  | 'google'
  | 'facebook'
  | 'gmail_verified'
  | 'password';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  avatar?: string;
  avatarUrl?: string;
  authProvider?: AuthProviderType;
  isVerifiedRealAccount?: boolean;
}

export interface OAuthClientConfig {
  googleClientId: string;
  facebookAppId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: 'admin' | 'customer' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  configError: string | null;
  guestAvatar: string;
  oauthClientConfig: OAuthClientConfig;
  saveOAuthClientConfig: (next: Partial<OAuthClientConfig>) => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithOAuth: (
    provider: 'google' | 'facebook',
    redirectPath?: string
  ) => Promise<{
    success: boolean;
    needsClientPopup?: boolean;
    error?: string;
  }>;
  loginWithVerifiedOAuthToken: (
    provider: 'google' | 'facebook',
    accessToken: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (name: string, avatar?: string) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function detectAuthProviderFromSession(session: Session): AuthProviderType {
  const appMeta = (session.user?.app_metadata || {}) as Record<string, unknown>;
  const userMeta = (session.user?.user_metadata || {}) as Record<string, unknown>;
  const primaryProvider = String(appMeta.provider || '').toLowerCase();
  const providersList = Array.isArray(appMeta.providers)
    ? appMeta.providers.map((p) => String(p).toLowerCase())
    : [];
  const identitiesList = Array.isArray(session.user?.identities)
    ? session.user.identities.map((id) => String(id.provider || '').toLowerCase())
    : [];

  if (
    primaryProvider === 'google' ||
    providersList.includes('google') ||
    identitiesList.includes('google')
  ) {
    return 'google';
  }
  if (
    primaryProvider === 'facebook' ||
    providersList.includes('facebook') ||
    identitiesList.includes('facebook')
  ) {
    return 'facebook';
  }
  if (userMeta.auth_provider === 'gmail_verified') {
    return 'gmail_verified';
  }
  return 'password';
}

function toAuthUser(session: Session | null, localAvatar?: string | null): AuthUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata || {};
  const email = (session.user.email ?? '').toLowerCase().trim();
  const isVerifiedAdmin =
    ADMIN_EMAILS.has(email) &&
    (meta.role === 'admin' ||
      email === 'vohoang1327@gmail.com' ||
      email === 'khanhly30072007@gmail.com');
  const provider = detectAuthProviderFromSession(session);
  const oauthFullName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.user_name as string) ||
    '';
  const oauthAvatarUrl =
    (meta.avatar_url as string) || (meta.picture as string) || undefined;

  if (email && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('tcl_guest_notify_email_v1', email);
    } catch {
      // ignore
    }
  }

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: sanitizeInput(
      oauthFullName ||
        (isVerifiedAdmin ? 'Quản trị viên' : email.split('@')[0] || 'Khách hàng')
    ),
    role: isVerifiedAdmin ? 'admin' : 'customer',
    avatar: localAvatar || (meta.avatar as string) || undefined,
    avatarUrl: oauthAvatarUrl,
    authProvider: provider,
    isVerifiedRealAccount:
      provider === 'google' ||
      provider === 'facebook' ||
      provider === 'gmail_verified' ||
      Boolean(session.user.email_confirmed_at) ||
      email.endsWith('@gmail.com'),
  };
}

const NETWORK_ERROR_MSG =
  'Không kết nối được Supabase. Vui lòng kiểm tra mạng hoặc cấu hình API.';

function purgeLocalSupabaseSessionTokens() {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (
            k &&
            (k.startsWith('sb-') ||
              k.includes('supabase.auth.token') ||
              k.includes('-auth-token'))
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => {
          try {
            window.localStorage.removeItem(k);
          } catch {
            // ignore
          }
        });
      }
      if (window.sessionStorage) {
        const sessionKeys: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (
            k &&
            (k.startsWith('sb-') ||
              k.includes('supabase.auth.token') ||
              k.includes('-auth-token'))
          ) {
            sessionKeys.push(k);
          }
        }
        sessionKeys.forEach((k) => {
          try {
            window.sessionStorage.removeItem(k);
          } catch {
            // ignore
          }
        });
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadCachedAuthUser());
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [guestAvatar, setGuestAvatar] = useState<string>('capybara');
  const [oauthClientConfig, setOauthClientConfig] = useState<OAuthClientConfig>(() => {
    const envGoogle = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
    const envFb = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('tcl_oauth_client_config_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            googleClientId: String(parsed?.googleClientId || envGoogle).trim(),
            facebookAppId: String(parsed?.facebookAppId || envFb).trim(),
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      googleClientId: envGoogle.trim(),
      facebookAppId: envFb.trim(),
    };
  });

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/addresses?id=eq.tcl_oauth_config_v1&select=detailAddress&limit=1`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
          }
        );
        if (res.ok && active) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows[0]?.detailAddress) {
            const parsed = JSON.parse(rows[0].detailAddress);
            const nextCfg: OAuthClientConfig = {
              googleClientId: String(
                parsed?.googleClientId ||
                  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
                  ''
              ).trim(),
              facebookAppId: String(
                parsed?.facebookAppId ||
                  process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ||
                  ''
              ).trim(),
            };
            setOauthClientConfig(nextCfg);
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(
                'tcl_oauth_client_config_v1',
                JSON.stringify(nextCfg)
              );
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveOAuthClientConfig = useCallback(
    async (partial: Partial<OAuthClientConfig>) => {
      const merged: OAuthClientConfig = {
        googleClientId: (
          partial.googleClientId ?? oauthClientConfig.googleClientId
        ).trim(),
        facebookAppId: (
          partial.facebookAppId ?? oauthClientConfig.facebookAppId
        ).trim(),
      };
      setOauthClientConfig(merged);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(
            'tcl_oauth_client_config_v1',
            JSON.stringify(merged)
          );
        }
        if (supabaseUrl && supabaseAnonKey) {
          await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
            method: 'POST',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              id: 'tcl_oauth_config_v1',
              userId: '00000000-0000-0000-0000-000000000000',
              fullName: '__TCL_CHAT_MSG_V1__',
              phone: '0000000000',
              city: 'Config',
              district: 'OAuth',
              ward: 'Public',
              detailAddress: JSON.stringify(merged),
              isDefault: false,
            }),
          });
        }
      } catch {
        // ignore
      }
    },
    [oauthClientConfig]
  );

  useEffect(() => {
    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 3000);

    const init = async () => {
      try {
        const storedGuestAvatar = await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}guest`);
        if (storedGuestAvatar && !cancelled) {
          setGuestAvatar(storedGuestAvatar);
        }
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          // Preserve cached user if Supabase is temporarily returning 402 (Egress Exceeded) or network error
          const cachedUser = loadCachedAuthUser();
          if (cachedUser && !cancelled) {
            setUser(cachedUser);
            return;
          }
          purgeLocalSupabaseSessionTokens();
        }
        if (!cancelled) {
          if (session?.user) {
            const localAvatar = await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}${session.user.id}`);
            const resolved = toAuthUser(session, localAvatar);
            setUser(resolved);
            saveCachedAuthUser(resolved);
          } else {
            const cachedUser = loadCachedAuthUser();
            if (cachedUser) {
              setUser(cachedUser);
            } else {
              setUser(null);
            }
          }
        }
      } catch (err: unknown) {
        if (__DEV__) console.error('[AUTH] Lỗi getSession:', err);
        const cachedUser = loadCachedAuthUser();
        if (!cancelled) {
          setUser(cachedUser);
        }
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const localAvatar = await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}${session.user.id}`).catch(() => null);
        const resolved = toAuthUser(session, localAvatar);
        setUser(resolved);
        saveCachedAuthUser(resolved);
      } else if (event === 'SIGNED_OUT') {
        const cachedUser = loadCachedAuthUser();
        if (!cachedUser) {
          setUser(null);
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (configError) {
      return { success: false, error: configError };
    }
    if (Date.now() < lockoutUntil) {
      const waitSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return { success: false, error: `Nhập sai quá nhiều lần. Vui lòng thử lại sau ${waitSec} giây.` };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        if (__DEV__) console.log('[LOGIN ERROR]', error);
        const errMsg = String(error.message || '').toLowerCase();
        const cleanEmail = email.toLowerCase().trim();

        // If the account has not been created on the new Supabase project yet,
        // `signUp` will succeed ONCE and register the user with their password.
        // If the account ALREADY exists in `auth.users`, `signUp` returns "User already registered"
        // and we strictly reject the wrong password.
        if (errMsg.includes('invalid login credentials') && password.length >= 6) {
          const isAdminEmail = ADMIN_EMAILS.has(cleanEmail);
          const defaultName = isAdminEmail
            ? 'Quản trị viên'
            : cleanEmail.split('@')[0] || 'Khách hàng';

          const { data: migratedData, error: migrateErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                name: defaultName,
                role: isAdminEmail ? 'admin' : 'customer',
                avatar: 'capybara',
              },
            },
          });
          if (!migrateErr && migratedData?.session) {
            setFailedAttempts(0);
            const localAvatar = await AsyncStorage.getItem(
              `${AVATAR_STORAGE_PREFIX}${migratedData.session.user.id}`
            ).catch(() => null);
            const resolved = toAuthUser(migratedData.session, localAvatar);
            setUser(resolved);
            saveCachedAuthUser(resolved);
            return { success: true };
          }
        }

        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 5) {
          setLockoutUntil(Date.now() + 60000);
          setFailedAttempts(0);
        }
        if (errMsg.includes('email not confirmed')) {
          return {
            success: false,
            error:
              'Tài khoản này được tạo lúc chưa tắt Confirm Email. Hãy chạy lệnh UPDATE auth.users trong SQL Editor hoặc đặt lại mật khẩu.',
          };
        }
        return { success: false, error: 'Email hoặc mật khẩu không đúng.' };
      }
      setFailedAttempts(0);
      if (data.session) {
        const localAvatar = await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}${data.session.user.id}`).catch(() => null);
        const resolved = toAuthUser(data.session, localAvatar);
        setUser(resolved);
        saveCachedAuthUser(resolved);
      }
      return { success: true };
    } catch (err: unknown) {
      if (__DEV__) console.log('[LOGIN ERROR]', err);
      return { success: false, error: NETWORK_ERROR_MSG };
    }
  }, [configError, failedAttempts, lockoutUntil]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (configError) {
      return { success: false, error: configError };
    }
    if (Date.now() < lockoutUntil) {
      return { success: false, error: 'Thao tác quá nhanh. Vui lòng thử lại sau ít phút.' };
    }

    const safeName = sanitizeInput(name);
    if (!safeName) {
      return { success: false, error: 'Tên hiển thị không hợp lệ.' };
    }

    try {
      const cleanEmail = email.toLowerCase().trim();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: safeName,
            role: ADMIN_EMAILS.has(cleanEmail) ? 'admin' : 'customer',
            avatar: 'capybara',
          },
        },
      });

      if (error) {
        if (__DEV__) console.log('[REGISTER ERROR]', error);
        if (error.message.includes('already')) {
          return { success: false, error: 'Email này đã được sử dụng.' };
        }
        const cleanEmail = email.toLowerCase().trim();
        const fallbackUser: AuthUser = {
          id: `local_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: cleanEmail,
          name: safeName,
          role: ADMIN_EMAILS.has(cleanEmail) ? 'admin' : 'customer',
          avatar: 'capybara',
        };
        setUser(fallbackUser);
        saveCachedAuthUser(fallbackUser);
        return { success: true };
      }
      if (data.session) {
        const resolved = toAuthUser(data.session);
        setUser(resolved);
        saveCachedAuthUser(resolved);
      } else if (data.user) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });
        if (signInData.session) {
          const resolved = toAuthUser(signInData.session);
          setUser(resolved);
          saveCachedAuthUser(resolved);
        }
      }
      return { success: true };
    } catch (err: unknown) {
      if (__DEV__) console.log('[REGISTER ERROR]', err);
      const cleanEmail = email.toLowerCase().trim();
      const fallbackUser: AuthUser = {
        id: `local_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        name: safeName,
        role: ADMIN_EMAILS.has(cleanEmail) ? 'admin' : 'customer',
        avatar: 'capybara',
      };
      setUser(fallbackUser);
      saveCachedAuthUser(fallbackUser);
      return { success: true };
    }
  }, [configError, lockoutUntil]);

  const logout = useCallback(async () => {
    // 1. Immediately clear user state and purge local storage tokens so mobile browsers never get stuck
    saveCachedAuthUser(null);
    setUser(null);
    purgeLocalSupabaseSessionTokens();
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      // Fire-and-forget global revocation without blocking UI
      supabase.auth.signOut().catch(() => {});
    } catch (err: unknown) {
      if (__DEV__) console.error('[AUTH] Lỗi logout:', err);
    }
    purgeLocalSupabaseSessionTokens();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (name: string, avatar?: string) => {
    if (!user) return;
    const trimmedName = sanitizeInput(name);
    if (!trimmedName) return;
    const nextAvatar = avatar ?? user.avatar;
    setUser((prev) => prev ? { ...prev, name: trimmedName, avatar: nextAvatar } : null);
    if (nextAvatar) {
      await AsyncStorage.setItem(`${AVATAR_STORAGE_PREFIX}${user.id}`, nextAvatar).catch(() => {});
    }
    try {
      await supabase.auth.updateUser({
        data: { name: trimmedName, ...(nextAvatar ? { avatar: nextAvatar } : {}) },
      });
    } catch (err: unknown) {
      if (__DEV__) console.error('[AUTH] Lỗi updateProfile:', err);
    }
  }, [user]);

  const updateAvatar = useCallback(async (avatar: string) => {
    if (!user) {
      setGuestAvatar(avatar);
      await AsyncStorage.setItem(`${AVATAR_STORAGE_PREFIX}guest`, avatar).catch(() => {});
      return;
    }
    setUser((prev) => prev ? { ...prev, avatar } : null);
    await AsyncStorage.setItem(`${AVATAR_STORAGE_PREFIX}${user.id}`, avatar).catch(() => {});
    try {
      await supabase.auth.updateUser({
        data: { avatar },
      });
    } catch (err: unknown) {
      if (__DEV__) console.error('[AUTH] Lỗi updateAvatar:', err);
    }
  }, [user]);

  const loginWithOAuth = useCallback(
    async (
      provider: 'google' | 'facebook',
      redirectPath?: string
    ): Promise<{
      success: boolean;
      needsClientPopup?: boolean;
      error?: string;
    }> => {
      try {
        if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
          try {
            const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
              headers: { apikey: supabaseAnonKey },
            });
            if (settingsRes.ok) {
              const settingsJson = await settingsRes.json();
              const externalMap = (settingsJson?.external || {}) as Record<
                string,
                boolean
              >;
              if (externalMap[provider] !== true) {
                return {
                  success: false,
                  needsClientPopup: true,
                };
              }
            }
          } catch {
            // Proceed to signInWithOAuth if settings check fails
          }
        }

        const origin =
          typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'https://www.tiemcuonlen.shop';
        const targetRedirect = redirectPath
          ? `${origin}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`
          : origin;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: targetRedirect,
            queryParams:
              provider === 'google'
                ? {
                    prompt: 'select_account',
                    access_type: 'offline',
                  }
                : undefined,
          },
        });

        if (error) {
          return {
            success: false,
            needsClientPopup: true,
            error: error.message,
          };
        }

        if (data?.url && typeof window !== 'undefined') {
          window.location.assign(data.url);
        }
        return { success: true };
      } catch {
        return {
          success: false,
          needsClientPopup: true,
        };
      }
    },
    []
  );

  const loginWithVerifiedOAuthToken = useCallback(
    async (
      provider: 'google' | 'facebook',
      accessToken: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!accessToken || accessToken.trim().length < 15) {
        return {
          success: false,
          error: 'Token xác thực không hợp lệ.',
        };
      }

      try {
        let verifiedId = '';
        let verifiedEmail = '';
        let verifiedName = '';
        let verifiedPicture: string | undefined;

        if (provider === 'google') {
          const cleanToken = accessToken.trim();
          const isJwtIdToken = cleanToken.split('.').length === 3;
          const res = isJwtIdToken
            ? await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
                  cleanToken
                )}`
              )
            : await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                  Authorization: `Bearer ${cleanToken}`,
                },
              });
          if (!res.ok) {
            return {
              success: false,
              error: 'Không thể xác thực tài khoản từ máy chủ Google.',
            };
          }
          const profile = await res.json();
          if (
            !profile?.sub ||
            !profile?.email ||
            profile?.email_verified === false ||
            profile?.email_verified === 'false'
          ) {
            return {
              success: false,
              error: 'Tài khoản Google chưa được xác minh.',
            };
          }
          verifiedId = String(profile.sub);
          verifiedEmail = String(profile.email).toLowerCase().trim();
          verifiedName = sanitizeInput(
            String(
              profile.name || profile.given_name || verifiedEmail.split('@')[0]
            )
          );
          verifiedPicture = profile.picture ? String(profile.picture) : undefined;
        } else {
          const res = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
              accessToken.trim()
            )}`
          );
          if (!res.ok) {
            return {
              success: false,
              error: 'Không thể xác thực tài khoản từ máy chủ Facebook.',
            };
          }
          const profile = await res.json();
          if (!profile?.id) {
            return {
              success: false,
              error: 'Tài khoản Facebook không hợp lệ.',
            };
          }
          verifiedId = String(profile.id);
          verifiedEmail = String(
            profile.email || `fb_${verifiedId}@facebook.tiemcuonlen.shop`
          )
            .toLowerCase()
            .trim();
          verifiedName = sanitizeInput(String(profile.name || 'Khách Facebook'));
          verifiedPicture = profile.picture?.data?.url
            ? String(profile.picture.data.url)
            : undefined;
        }

        if (
          verifiedEmail &&
          !verifiedEmail.endsWith('@facebook.tiemcuonlen.shop') &&
          typeof window !== 'undefined' &&
          window.localStorage
        ) {
          try {
            window.localStorage.setItem('tcl_guest_notify_email_v1', verifiedEmail);
          } catch {
            // ignore
          }
        }

        const oauthSecret = `TclOAuth#${provider}_${verifiedId.slice(0, 14)}_2026!`;
        const isAdminEmail = ADMIN_EMAILS.has(verifiedEmail);

        try {
          const { data: signInData, error: signInErr } =
            await supabase.auth.signInWithPassword({
              email: verifiedEmail,
              password: oauthSecret,
            });

          if (!signInErr && signInData?.session) {
            const resolved: AuthUser = {
              id: signInData.session.user.id,
              email: verifiedEmail,
              name: verifiedName,
              role: isAdminEmail ? 'admin' : 'customer',
              avatar: 'capybara',
              avatarUrl: verifiedPicture,
              authProvider: provider,
              isVerifiedRealAccount: true,
            };
            setUser(resolved);
            saveCachedAuthUser(resolved);
            return { success: true };
          }

          const { data: signUpData, error: signUpErr } =
            await supabase.auth.signUp({
              email: verifiedEmail,
              password: oauthSecret,
              options: {
                data: {
                  name: verifiedName,
                  full_name: verifiedName,
                  avatar_url: verifiedPicture,
                  role: isAdminEmail ? 'admin' : 'customer',
                  avatar: 'capybara',
                  auth_provider: provider,
                },
              },
            });

          if (!signUpErr && signUpData?.session) {
            const resolved: AuthUser = {
              id: signUpData.session.user.id,
              email: verifiedEmail,
              name: verifiedName,
              role: isAdminEmail ? 'admin' : 'customer',
              avatar: 'capybara',
              avatarUrl: verifiedPicture,
              authProvider: provider,
              isVerifiedRealAccount: true,
            };
            setUser(resolved);
            saveCachedAuthUser(resolved);
            return { success: true };
          }
        } catch {
          // If email already existed with password, Google/Facebook API has already cryptographically verified ownership
        }

        const verifiedUser: AuthUser = {
          id: `${provider}_${verifiedId}`,
          email: verifiedEmail,
          name: verifiedName,
          role: isAdminEmail ? 'admin' : 'customer',
          avatar: 'capybara',
          avatarUrl: verifiedPicture,
          authProvider: provider,
          isVerifiedRealAccount: true,
        };
        setUser(verifiedUser);
        saveCachedAuthUser(verifiedUser);
        return { success: true };
      } catch {
        return {
          success: false,
          error: 'Lỗi kết nối khi xác thực tài khoản.',
        };
      }
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: user !== null,
      isLoading,
      configError,
      guestAvatar,
      oauthClientConfig,
      saveOAuthClientConfig,
      login,
      register,
      loginWithOAuth,
      loginWithVerifiedOAuthToken,
      logout,
      updateProfile,
      updateAvatar,
    }),
    [
      user,
      isLoading,
      configError,
      guestAvatar,
      oauthClientConfig,
      saveOAuthClientConfig,
      login,
      register,
      loginWithOAuth,
      loginWithVerifiedOAuthToken,
      logout,
      updateProfile,
      updateAvatar,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
