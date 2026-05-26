import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { Product, CartItem, Review } from '@/types/product';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

interface ShopContextType {
  products: Product[];
  cart: CartItem[];
  favorites: string[];
  isLoading: boolean;
  cartHydrated: boolean;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Product) => void;
  removeProduct: (id: string) => void;
  addReview: (productId: string, review: Review) => void;
  addToCart: (product: Product, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  cartTotal: number;
  cartCount: number;
  refetchCartFavorites: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | null>(null);

function getCartOwnerId(user: { id: string; email: string } | null): string {
  // Stable owner id: use Supabase auth UUID, fallback to email, fallback to guest
  return user?.id || user?.email || 'guest';
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const prevOwnerId = useRef<string>('');

  const cartOwnerId = getCartOwnerId(user);

  // Hydrate cart from localStorage (web) / AsyncStorage fallback
  const hydrateCartFromStorage = useCallback((): CartItem[] | null => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(`cart_${cartOwnerId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as CartItem[];
      }
    } catch {
      // ignore
    }
    return null;
  }, [cartOwnerId]);

  // Persist cart to localStorage
  const persistCart = useCallback((items: CartItem[]) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`cart_${cartOwnerId}`, JSON.stringify(items));
      }
    } catch {
      // ignore
    }
  }, [cartOwnerId]);

  // ─── Fetch cart + favorites from Supabase ───
  const fetchCartFavorites = useCallback(async () => {
    if (!user) {
      console.log('[CART RESTORE] no user');
      // Don't clear if already hydrated — wait for real auth state
      return;
    }

    console.log('[CART FETCH] user', user.id);

    const { data } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('user_id', user.id);

    if (data && data.length > 0) {
      const items: CartItem[] = data
        .map((ci: any) => {
          const product = products.find((p) => p.id === ci.product_id);
          if (product) return { product, quantity: ci.quantity };
          return { product: { id: ci.product_id, name: 'Sản phẩm', price: 0 } as Product, quantity: ci.quantity };
        })
        .filter((ci) => ci.quantity > 0);
      console.log('[CART HYDRATE RESULT]', items.length, 'items from Supabase');
      setCart(items);
      persistCart(items);
    } else {
      // Try localStorage fallback
      const localCart = hydrateCartFromStorage();
      if (localCart && localCart.length > 0) {
        console.log('[CART HYDRATE RESULT]', localCart.length, 'items from localStorage');
        setCart(localCart);
      }
      // else: truly empty cart — that's fine
    }

    setCartHydrated(true);

    // Fetch favorites
    supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data: favData }) => {
        if (favData) setFavorites(favData.map((f: any) => f.product_id));
      });
  }, [user, products, persistCart, hydrateCartFromStorage]);

  // Track owner changes — clear ONLY when switching users
  useEffect(() => {
    if (prevOwnerId.current && prevOwnerId.current !== cartOwnerId) {
      console.log('[CART OWNER SWITCH]', prevOwnerId.current, '→', cartOwnerId);
      setCart([]);
      setCartHydrated(false);
      setFavorites([]);
    }
    prevOwnerId.current = cartOwnerId;
  }, [cartOwnerId]);

  // Load products
  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('createdAt', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[SUPABASE] Lỗi load sản phẩm:', error.message);
        if (data) setProducts(data as Product[]);
        setLoaded(true);
      });
  }, []);

  // Fetch cart + favorites on mount / user change
  useEffect(() => {
    if (!user) {
      // User not logged in — hydrate from localStorage
      const localCart = hydrateCartFromStorage();
      if (localCart && localCart.length > 0) {
        console.log('[CART HYDRATE RESULT]', localCart.length, 'items from localStorage (guest)');
        setCart(localCart);
      }
      setCartHydrated(true);
      setFavorites([]);
      return;
    }

    fetchCartFavorites();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // bfcache recovery: Safari/Zalo restore pages from cache
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[CART RESTORE] bfcache restore');
        if (user) {
          fetchCartFavorites();
        } else {
          const localCart = hydrateCartFromStorage();
          if (localCart) setCart(localCart);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[CART RESTORE] visibility change');
        if (user) {
          fetchCartFavorites();
        } else {
          const localCart = hydrateCartFromStorage();
          if (localCart) setCart(localCart);
        }
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchCartFavorites, hydrateCartFromStorage]);

  const refetchCartFavorites = useCallback(async () => {
    if (user) {
      await fetchCartFavorites();
    } else {
      const localCart = hydrateCartFromStorage();
      if (localCart) setCart(localCart);
    }
  }, [user, fetchCartFavorites, hydrateCartFromStorage]);

  // ─── Product CRUD ───
  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [product, ...prev]);
    const { isFavorite, ...dbProduct } = product;
    supabase.from('products').insert(dbProduct).then(({ error }) => {
      if (error) console.error('[SUPABASE] Lỗi thêm sản phẩm:', error.message);
    });
  }, []);

  const updateProduct = useCallback((id: string, product: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? product : p)));
    const { isFavorite, ...dbProduct } = product;
    supabase.from('products').update(dbProduct).eq('id', id).then(({ error }) => {
      if (error) console.error('[SUPABASE] Lỗi sửa sản phẩm:', error.message);
    });
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    supabase.from('products').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('[SUPABASE] Lỗi xoá sản phẩm:', error.message);
    });
  }, []);

  const addReview = useCallback((productId: string, review: Review) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const newReviews = [...p.reviews, review];
        const avgRating = newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length;
        const updated = { ...p, reviews: newReviews, rating: Math.round(avgRating * 10) / 10 };
        supabase.from('products').update({ reviews: newReviews, rating: updated.rating }).eq('id', productId).then(({ error }) => {
          if (error) console.error('[SUPABASE] Lỗi thêm review:', error.message);
        });
        return updated;
      })
    );
  }, []);

  // ─── Cart ───
  const syncCartToSupabase = useCallback(async (productId: string, quantity: number | null) => {
    if (!user) return;
    console.log('[CART PERSIST] supabase', { userId: user.id, productId, quantity });
    if (quantity === null || quantity <= 0) {
      await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', productId);
    } else {
      await supabase.from('cart_items').upsert(
        { user_id: user.id, product_id: productId, quantity },
        { onConflict: 'user_id,product_id' },
      );
    }
    console.log('[CART PERSIST DONE]', productId);
  }, [user]);

  const addToCart = useCallback(async (product: Product, quantity: number) => {
    console.log('[CART ADD]', product.id, quantity);
    let newQty = quantity;

    const nextCart = produceNewCart(cart, product, quantity, (q) => { newQty = q; });
    setCart(nextCart);
    persistCart(nextCart);

    await syncCartToSupabase(product.id, newQty);
    console.log('[CART ADDED]', product.id);
  }, [cart, persistCart, syncCartToSupabase]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = prev.filter((ci) => ci.product.id !== productId);
      persistCart(next);
      syncCartToSupabase(productId, null);
      return next;
    });
  }, [persistCart, syncCartToSupabase]);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) => {
      const next = prev.map((ci) => ci.product.id === productId ? { ...ci, quantity } : ci);
      persistCart(next);
      syncCartToSupabase(productId, quantity);
      return next;
    });
  }, [persistCart, syncCartToSupabase, removeFromCart]);

  const clearCart = useCallback(() => {
    console.trace('[CART CLEAR TRACE]');
    setCart([]);
    persistCart([]);
    if (user) {
      supabase.from('cart_items').delete().eq('user_id', user.id).then(() => {});
    }
  }, [user, persistCart]);

  // ─── Favorites ───
  const toggleFavorite = useCallback((productId: string) => {
    if (!user) return;
    setFavorites((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', productId).then(() => {});
        return prev.filter((id) => id !== productId);
      }
      supabase.from('favorites').insert({ user_id: user.id, product_id: productId }).then(() => {});
      return [...prev, productId];
    });
  }, [user]);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites],
  );

  const cartTotal = cart.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0);
  const cartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  return (
    <ShopContext.Provider
      value={{
        products,
        cart,
        favorites,
        isLoading: !loaded,
        cartHydrated,
        addProduct,
        updateProduct,
        removeProduct,
        addReview,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        toggleFavorite,
        isFavorite,
        cartTotal,
        cartCount,
        refetchCartFavorites,
      }}>
      {children}
    </ShopContext.Provider>
  );
}

/** Pure function: compute new cart array without relying on closure state */
function produceNewCart(
  currentCart: CartItem[],
  product: Product,
  quantity: number,
  onNewQty: (q: number) => void,
): CartItem[] {
  const existing = currentCart.find((ci) => ci.product.id === product.id);
  if (existing) {
    const newQty = existing.quantity + quantity;
    onNewQty(newQty);
    return currentCart.map((ci) => ci.product.id === product.id ? { ...ci, quantity: newQty } : ci);
  }
  onNewQty(quantity);
  return [...currentCart, { product, quantity }];
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error('useShop must be used within ShopProvider');
  }
  return ctx;
}
