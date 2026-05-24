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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Lấy session hiện tại – bỏ qua lỗi refresh token
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(toAuthUser(session));
      setIsLoading(false);
    }).catch(() => {
      // Token cũ/hết hạn – coi như chưa đăng nhập
      setUser(null);
      setIsLoading(false);
    });

    // Lắng nghe thay đổi auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setUser(toAuthUser(session));
      } else if (event === 'USER_UPDATED') {
        setUser(toAuthUser(session));
      } else {
        setUser(toAuthUser(session));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) {
      return { success: false, error: 'Email hoặc mật khẩu không đúng.' };
    }
    return { success: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: { name: name.trim(), role: 'customer' },
      },
    });
    if (error) {
      if (error.message.includes('already')) {
        return { success: false, error: 'Email này đã được sử dụng.' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    if (!user) return;
    const { error } = await supabase.auth.updateUser({
      data: { name: name.trim() },
    });
    if (!error) {
      setUser((prev) => prev ? { ...prev, name: name.trim() } : null);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: user !== null,
        isLoading,
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
