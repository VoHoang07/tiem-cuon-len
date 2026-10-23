import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem('favorites_guest');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setFavorites(parsed as string[]);
              return;
            }
          }
        }
      } catch {
        // ignore
      }
      setFavorites([]);
      return;
    }
    supabase
      .from('favorites')
      .select('productId')
      .eq('userId', user.id)
      .then(({ data }) => {
        if (data) setFavorites((data as { productId: string }[]).map((f) => f.productId));
      }, () => {});
  }, [user]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];

      if (!user) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('favorites_guest', JSON.stringify(next));
          }
        } catch {
          // ignore
        }
        return next;
      }

      if (exists) {
        supabase.from('favorites').delete().eq('userId', user.id).eq('productId', productId).then(({ error }) => {
          if (error && __DEV__) console.error('[SUPABASE] Lỗi xoá favorite:', error.message);
        }, () => {});
      } else {
        supabase.from('favorites').insert({ userId: user.id, productId }).then(({ error }) => {
          if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm favorite:', error.message);
        }, () => {});
      }
      return next;
    });
  }, [user]);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites],
  );

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
