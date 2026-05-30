import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { Product, CartItem } from '@/types/product';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

interface CartContextType {
  cart: CartItem[];
  cartHydrated: boolean;
  cartTotal: number;
  cartCount: number;
  addToCart: (product: Product, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  refetchCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

function getCartOwnerId(user: { id: string; email: string } | null): string {
  return user?.id || 'guest';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const prevOwnerId = useRef<string>('');

  const cartOwnerId = getCartOwnerId(user);

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

  const persistCart = useCallback((items: CartItem[]) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`cart_${cartOwnerId}`, JSON.stringify(items));
      }
    } catch {
      // ignore
    }
  }, [cartOwnerId]);

  const fetchCart = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('userId', user.id);

    if (data && data.length > 0) {
      const cartRows = data as { product_id: string; quantity: number }[];
      const productIds = [...new Set(cartRows.map((r) => r.product_id))];

      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      const productMap = new Map((products ?? []).map((p) => [p.id, p]));

      const items: CartItem[] = cartRows
        .map((ci) => {
          const product = productMap.get(ci.product_id);
          if (!product) return null;
          return { product: product as Product, quantity: ci.quantity };
        })
        .filter((ci): ci is CartItem => ci !== null && ci.quantity > 0);
      setCart(items);
      persistCart(items);
    } else {
      const localCart = hydrateCartFromStorage();
      if (localCart && localCart.length > 0) {
        setCart(localCart);
      }
    }

    setCartHydrated(true);
  }, [user, persistCart, hydrateCartFromStorage]);

  useEffect(() => {
    if (prevOwnerId.current && prevOwnerId.current !== cartOwnerId) {
      setCart([]);
      setCartHydrated(false);
    }
    prevOwnerId.current = cartOwnerId;
  }, [cartOwnerId]);

  useEffect(() => {
    if (!user) {
      const localCart = hydrateCartFromStorage();
      if (localCart && localCart.length > 0) {
        setCart(localCart);
      }
      setCartHydrated(true);
      return;
    }

    fetchCart();
  }, [user, fetchCart, hydrateCartFromStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        if (user) {
          fetchCart();
        } else {
          const localCart = hydrateCartFromStorage();
          if (localCart) setCart(localCart);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (user) {
          fetchCart();
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
  }, [user, fetchCart, hydrateCartFromStorage]);

  const refetchCart = useCallback(async () => {
    if (user) {
      await fetchCart();
    } else {
      const localCart = hydrateCartFromStorage();
      if (localCart) setCart(localCart);
    }
  }, [user, fetchCart, hydrateCartFromStorage]);

  const syncCartToSupabase = useCallback(async (productId: string, quantity: number | null) => {
    if (!user) return;
    if (quantity === null || quantity <= 0) {
      await supabase.from('cart_items').delete().eq('userId', user.id).eq('productId', productId);
    } else {
      await supabase.from('cart_items').upsert(
        { userId: user.id, productId, quantity },
        { onConflict: 'userId,productId' },
      );
    }
  }, [user]);

  const addToCart = useCallback(async (product: Product, quantity: number) => {
    let newQty = quantity;

    const nextCart = produceNewCart(cart, product, quantity, (q) => { newQty = q; });
    setCart(nextCart);
    persistCart(nextCart);

    await syncCartToSupabase(product.id, newQty);
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
    setCart([]);
    persistCart([]);
    if (user) {
      supabase.from('cart_items').delete().eq('userId', user.id).then(({ error }) => {
        if (error && __DEV__) console.error('[SUPABASE] Lỗi xoá giỏ hàng:', error.message);
      }, () => {});
    }
  }, [user, persistCart]);

  const cartTotal = cart.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0);
  const cartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartHydrated,
        cartTotal,
        cartCount,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        refetchCart,
      }}>
      {children}
    </CartContext.Provider>
  );
}

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

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
