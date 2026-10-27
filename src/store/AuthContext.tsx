import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import type { Session } from '@supabase/supabase-js';

const AVATAR_STORAGE_PREFIX = '@tiem_cuon_len_avatar_';

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
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: (meta.name as string) ?? '',
    role: (meta.role as 'admin' | 'customer') ?? 'customer',
    avatar: localAvatar || (meta.avatar as string) || undefined,
  };
}

const NETWORK_ERROR_MSG =
  'Không kết nối được Supabase. Vui lòng kiểm tra mạng hoặc cấu hình API.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          const localAvatar = session?.user
            ? await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}${session.user.id}`)
            : null;
          setUser(toAuthUser(session, localAvatar));
        }
      } catch (err: unknown) {
        if (__DEV__) console.error('[AUTH] Lỗi getSession:', err);
        if (!cancelled) {
          setConfigError(NETWORK_ERROR_MSG);
          setUser(null);
        }
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const localAvatar = session?.user
        ? await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}${session.user.id}`).catch(() => null)
        : null;
      setUser(toAuthUser(session, localAvatar));
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (configError) {
      return { success: false, error: configError };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        if (__DEV__) console.log('[LOGIN ERROR]', error);
        return { success: false, error: 'Email hoặc mật khẩu không đúng.' };
      }
      if (data.session) {
        const localAvatar = await AsyncStorage.getItem(`${AVATAR_STORAGE_PREFIX}${data.session.user.id}`).catch(() => null);
        setUser(toAuthUser(data.session, localAvatar));
      }
      return { success: true };
    } catch (err: unknown) {
      if (__DEV__) console.log('[LOGIN ERROR]', err);
      return { success: false, error: NETWORK_ERROR_MSG };
    }
  }, [configError]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (configError) {
      return { success: false, error: configError };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: { name: name.trim(), role: 'customer', avatar: 'capybara' },
        },
      });

      if (error) {
        if (__DEV__) console.log('[REGISTER ERROR]', error);
        if (error.message.includes('already')) {
          return { success: false, error: 'Email này đã được sử dụng.' };
        }
        return { success: false, error: error.message };
      }
      if (data.session) {
        setUser(toAuthUser(data.session));
      } else if (data.user) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });
        if (signInData.session) {
          setUser(toAuthUser(signInData.session));
        }
      }
      return { success: true };
    } catch (err: unknown) {
      if (__DEV__) console.log('[REGISTER ERROR]', err);
      return { success: false, error: NETWORK_ERROR_MSG };
    }
  }, [configError]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: unknown) {
      if (__DEV__) console.error('[AUTH] Lỗi logout:', err);
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (name: string, avatar?: string) => {
    if (!user) return;
    const trimmedName = name.trim();
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

  return (
    <AuthContext.Provider
      value={{
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
      }}>
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
