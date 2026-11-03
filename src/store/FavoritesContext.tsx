import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
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

function readLocalFavorites(key: string): string[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string');
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalFavorites(key: string, ids: string[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(ids));
    }
  } catch {
    // ignore
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setFavorites(readLocalFavorites('favorites_guest'));
      return;
    }

    const userKey = `favorites_${user.id}`;
    const localUserFavs = readLocalFavorites(userKey);
    const guestFavs = readLocalFavorites('favorites_guest');
    const initialMerged = Array.from(new Set([...localUserFavs, ...guestFavs]));

    if (guestFavs.length > 0) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('favorites_guest');
        }
      } catch {
        // ignore
      }
    }

    setFavorites(initialMerged);
    writeLocalFavorites(userKey, initialMerged);

    supabase
      .from('favorites')
      .select('productId')
      .eq('userId', user.id)
      .then(
        ({ data }) => {
          const remoteIds = Array.isArray(data)
            ? (data as { productId: string }[]).map((f) => f.productId)
            : [];
          setFavorites((prev) => {
            const merged = Array.from(new Set([...prev, ...remoteIds]));
            writeLocalFavorites(userKey, merged);
            return merged;
          });
        },
        () => {}
      );
  }, [user]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];

      const storageKey = user ? `favorites_${user.id}` : 'favorites_guest';
      writeLocalFavorites(storageKey, next);

      if (!user) {
        return next;
      }

      if (exists) {
        supabase.from('favorites').delete().eq('userId', user.id).eq('productId', productId).then(() => {}, () => {});
      } else {
        supabase.from('favorites').insert({ userId: user.id, productId }).then(() => {}, () => {});
      }
      return next;
    });
  }, [user]);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback(
    (productId: string) => favoritesSet.has(productId),
    [favoritesSet],
  );

  const contextValue = useMemo(
    () => ({ favorites, toggleFavorite, isFavorite }),
    [favorites, toggleFavorite, isFavorite]
  );

  return (
    <FavoritesContext.Provider value={contextValue}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
