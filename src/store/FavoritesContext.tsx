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
      setFavorites([]);
      return;
    }
    supabase
      .from('favorites')
      .select('product_id')
      .eq('userId', user.id)
      .then(({ data }) => {
        if (data) setFavorites((data as { product_id: string }[]).map((f) => f.product_id));
      }, () => {});
  }, [user]);

  const toggleFavorite = useCallback((productId: string) => {
    if (!user) return;
    setFavorites((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        supabase.from('favorites').delete().eq('userId', user.id).eq('productId', productId).then(({ error }) => {
          if (error && __DEV__) console.error('[SUPABASE] Lỗi xoá favorite:', error.message);
        }, () => {});
        return prev.filter((id) => id !== productId);
      }
      supabase.from('favorites').insert({ userId: user.id, productId }).then(({ error }) => {
        if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm favorite:', error.message);
      }, () => {});
      return [...prev, productId];
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
