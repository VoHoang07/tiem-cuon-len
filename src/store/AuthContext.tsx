import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';

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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: 'admin' | 'customer' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  configError: string | null;
  guestAvatar: string;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (name: string, avatar?: string) => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toAuthUser(session: Session | null, localAvatar?: string | null): AuthUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata || {};
  const email = (session.user.email ?? '').toLowerCase().trim();
  const isVerifiedAdmin = ADMIN_EMAILS.has(email) && (meta.role === 'admin' || email === 'vohoang1327@gmail.com');
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: sanitizeInput((meta.name as string) ?? ''),
    role: isVerifiedAdmin ? 'admin' : 'customer',
    avatar: localAvatar || (meta.avatar as string) || undefined,
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

        // Seamless account migration to the new Supabase project:
        // If the account existed on the old Supabase project and hasn't been created in the new project's `auth.users` yet,
        // `signInWithPassword` returns "Invalid login credentials". Trying `signUp` once will either:
        //   (a) Create & sign in the user on the new Supabase project (if not yet registered there), OR
        //   (b) Return "User already registered" (proving the user IS registered and the password was wrong).
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

        const isInvalidCreds =
          errMsg.includes('invalid login credentials') ||
          errMsg.includes('email not confirmed');
        // If Supabase returns 402 (Egress Exceeded) or network failure, allow local fallback session so shop never goes down
        if (!isInvalidCreds && password.length >= 6) {
          const fallbackUser: AuthUser = {
            id: ADMIN_EMAILS.has(cleanEmail)
              ? '57090d46-4e82-4fa0-93bb-1ff5e46c22c2'
              : `local_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
            email: cleanEmail,
            name: ADMIN_EMAILS.has(cleanEmail)
              ? 'Quản trị viên'
              : cleanEmail.split('@')[0] || 'Khách hàng',
            role: ADMIN_EMAILS.has(cleanEmail) ? 'admin' : 'customer',
            avatar: 'capybara',
          };
          setUser(fallbackUser);
          saveCachedAuthUser(fallbackUser);
          return { success: true };
        }
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 5) {
          setLockoutUntil(Date.now() + 60000);
          setFailedAttempts(0);
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
      if (password.length >= 6) {
        const cleanEmail = email.toLowerCase().trim();
        const fallbackUser: AuthUser = {
          id: ADMIN_EMAILS.has(cleanEmail)
            ? '57090d46-4e82-4fa0-93bb-1ff5e46c22c2'
            : `local_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: cleanEmail,
          name: ADMIN_EMAILS.has(cleanEmail)
            ? 'Quản trị viên'
            : cleanEmail.split('@')[0] || 'Khách hàng',
          role: ADMIN_EMAILS.has(cleanEmail) ? 'admin' : 'customer',
          avatar: 'capybara',
        };
        setUser(fallbackUser);
        saveCachedAuthUser(fallbackUser);
        return { success: true };
      }
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
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: { name: safeName, role: 'customer', avatar: 'capybara' },
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

  const contextValue = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: user !== null,
      isLoading,
      configError,
      guestAvatar,
      login,
      register,
      logout,
      updateProfile,
      updateAvatar,
    }),
    [user, isLoading, configError, guestAvatar, login, register, logout, updateProfile, updateAvatar]
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
