import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/services/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

interface AuthContextType {
  user: AuthUser | null;
  role: 'admin' | 'customer' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  configError: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toAuthUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata || {};
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: (meta.name as string) ?? '',
    role: (meta.role as 'admin' | 'customer') ?? 'customer',
  };
}

const NETWORK_ERROR_MSG =
  'Không kết nối được Supabase. Vui lòng kiểm tra mạng hoặc cấu hình API.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          setUser(toAuthUser(session));
        }
      } catch (err: unknown) {
        if (__DEV__) console.error('[AUTH] Lỗi getSession:', err);
        if (!cancelled) {
          setConfigError(NETWORK_ERROR_MSG);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(toAuthUser(session));
      } else {
        setUser(toAuthUser(session));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (configError) {
      return { success: false, error: configError };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        if (__DEV__) console.log('[LOGIN ERROR]', error);
        return { success: false, error: 'Email hoặc mật khẩu không đúng.' };
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
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: { name: name.trim(), role: 'customer' },
        },
      });

      if (error) {
        if (__DEV__) console.log('[REGISTER ERROR]', error);
        if (error.message.includes('already')) {
          return { success: false, error: 'Email này đã được sử dụng.' };
        }
        return { success: false, error: error.message };
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

  const updateProfile = useCallback(async (name: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });
      if (!error) {
        setUser((prev) => prev ? { ...prev, name: name.trim() } : null);
      }
    } catch (err: unknown) {
      if (__DEV__) console.error('[AUTH] Lỗi updateProfile:', err);
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
        login,
        register,
        logout,
        updateProfile,
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
