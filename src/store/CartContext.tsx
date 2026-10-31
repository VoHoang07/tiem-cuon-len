import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Platform, AppState } from 'react-native';
import { Product, CartItem } from '@/types/product';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { MOCK_PRODUCTS } from '@/data/products';

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

function getBaseProductId(productId: string, baseProductId?: string): string {
  if (baseProductId) return baseProductId;
  return productId.split('__')[0];
}

function rehydrateCartItem(ci: CartItem): CartItem {
  if (!ci || !ci.product) return ci;
  const p = ci.product;
  const baseId = getBaseProductId(p.id, p.baseProductId);
  const parts = p.id.split('__');
  const parsedColorId = p.selectedColorId || (parts.length >= 2 ? parts[1] : undefined);
  const parsedAccId = p.selectedAccessoryId || (parts.length >= 3 ? parts[2] : undefined);

  const mock = MOCK_PRODUCTS.find((m) => m.id === baseId);
  if (!mock) return ci;

  const colorOpt =
    mock.colorOptions?.find((c) => c.id === parsedColorId) ||
    mock.colorOptions?.find(
      (c) =>
        c.name.toLowerCase() ===
        (p.selectedColorName || p.color || '').trim().toLowerCase()
    ) ||
    mock.colorOptions?.[0];

  const accOpt =
    mock.accessoryOptions?.find((a) => a.id === parsedAccId) ||
    mock.accessoryOptions?.find(
      (a) =>
        a.name.toLowerCase() === (p.selectedAccessoryName || '').trim().toLowerCase()
    ) ||
    mock.accessoryOptions?.[0];

  const resolvedImage = colorOpt?.image || p.image || mock.image;
  // Product's price already includes accessory priceDelta (set by buildVariantProduct).
  // Only fall back to mock base price + delta when price is missing/zero.
  const resolvedPrice =
    p.price && p.price > 0
      ? p.price
      : mock.price + (accOpt?.priceDelta ?? 0);

  return {
    ...ci,
    selectedColor: p.selectedColorName || colorOpt?.name || ci.selectedColor,
    selectedAccessory:
      p.selectedAccessoryName || accOpt?.name || ci.selectedAccessory,
    product: {
      ...p,
      baseProductId: baseId,
      image: resolvedImage,
      price: resolvedPrice,
      selectedColorId: colorOpt?.id ?? parsedColorId,
      selectedColorName: p.selectedColorName || colorOpt?.name || p.color,
      selectedColorHex: p.selectedColorHex || colorOpt?.hex,
      selectedAccessoryId: accOpt?.id ?? parsedAccId,
      selectedAccessoryName: p.selectedAccessoryName || accOpt?.name,
      selectedAccessoryEmoji: p.selectedAccessoryEmoji || accOpt?.emoji,
    },
  };
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
        if (Array.isArray(parsed)) {
          return (parsed as CartItem[]).map(rehydrateCartItem);
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [cartOwnerId]);

  const persistCart = useCallback(
    (items: CartItem[]) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`cart_${cartOwnerId}`, JSON.stringify(items));
        }
      } catch {
        // ignore
      }
    },
    [cartOwnerId]
  );

  const fetchCart = useCallback(async () => {
    if (!user) return;

    let guestCart: CartItem[] = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawGuest = window.localStorage.getItem('cart_guest');
        if (rawGuest) {
          const parsed = JSON.parse(rawGuest);
          if (Array.isArray(parsed)) {
            guestCart = (parsed as CartItem[]).map(rehydrateCartItem);
          }
          window.localStorage.removeItem('cart_guest');
        }
      }
    } catch {
      // ignore
    }

    // Prefer rich localStorage cart (which preserves exact color & accessory variants)
    const localCart = hydrateCartFromStorage();
    let baseItems: CartItem[] = localCart && localCart.length > 0 ? localCart : [];

    if (baseItems.length === 0) {
      const { data } = await supabase
        .from('cart_items')
        .select('productId, quantity')
        .eq('userId', user.id);

      if (data && data.length > 0) {
        const cartRows = data as { productId: string; quantity: number }[];
        const productIds = [...new Set(cartRows.map((r) => r.productId))];

        const { data: products } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);

        const productMap = new Map((products ?? []).map((p) => [p.id, p]));

        baseItems = cartRows
          .map((ci) => {
            const baseId = getBaseProductId(ci.productId);
            const mock = MOCK_PRODUCTS.find((m) => m.id === baseId);
            const product = (productMap.get(ci.productId) || mock) as Product | undefined;
            if (!product) return null;
            return rehydrateCartItem({
              product: { ...product, id: ci.productId },
              quantity: ci.quantity,
            });
          })
          .filter((ci): ci is CartItem => ci !== null && ci.quantity > 0);
      }
    }

    if (guestCart.length > 0) {
      const mergedMap = new Map<string, CartItem>();
      for (const item of baseItems) {
        mergedMap.set(item.product.id, { ...item });
      }
      for (const gItem of guestCart) {
        const existing = mergedMap.get(gItem.product.id);
        if (existing) {
          existing.quantity += gItem.quantity;
          existing.product = gItem.product;
        } else {
          mergedMap.set(gItem.product.id, { ...gItem });
        }
      }
      baseItems = Array.from(mergedMap.values());
    }

    setCart(baseItems);
    persistCart(baseItems);
    setCartHydrated(true);
  }, [user, persistCart, hydrateCartFromStorage]);

  useEffect(() => {
    if (
      prevOwnerId.current &&
      prevOwnerId.current !== cartOwnerId &&
      prevOwnerId.current !== 'guest'
    ) {
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
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePageShow = (e: PageTransitionEvent) => {
        if (e.persisted) {
          const localCart = hydrateCartFromStorage();
          if (localCart) setCart(localCart);
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          const localCart = hydrateCartFromStorage();
          if (localCart) setCart(localCart);
        }
      };

      window.addEventListener('pageshow', handlePageShow);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        window.removeEventListener('pageshow', handlePageShow);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const localCart = hydrateCartFromStorage();
        if (localCart) setCart(localCart);
      }
    });

    return () => sub.remove();
  }, [hydrateCartFromStorage]);

  const refetchCart = useCallback(async () => {
    const localCart = hydrateCartFromStorage();
    if (localCart) {
      setCart(localCart);
    } else if (user) {
      await fetchCart();
    }
  }, [user, fetchCart, hydrateCartFromStorage]);

  const syncCartToSupabase = useCallback(
    async (productId: string, quantity: number | null) => {
      if (!user) return;
      try {
        if (quantity === null || quantity <= 0) {
          await supabase
            .from('cart_items')
            .delete()
            .eq('userId', user.id)
            .eq('productId', productId);
        } else {
          await supabase.from('cart_items').upsert(
            { userId: user.id, productId, quantity },
            { onConflict: 'userId,productId' }
          );
        }
      } catch {
        // ignore if productId is local-only mock ID
      }
    },
    [user]
  );

  const addToCart = useCallback(
    async (product: Product, quantity: number) => {
      let newQty = quantity;
      const rehydrated = rehydrateCartItem({
        product,
        quantity,
        selectedColor: product.selectedColorName || product.color,
        selectedAccessory: product.selectedAccessoryName,
      });

      setCart((prev) => {
        const nextCart = produceNewCart(
          prev,
          rehydrated.product,
          quantity,
          (q) => {
            newQty = q;
          }
        );
        persistCart(nextCart);
        return nextCart;
      });

      await syncCartToSupabase(rehydrated.product.id, newQty);
    },
    [persistCart, syncCartToSupabase]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      setCart((prev) => {
        const next = prev.filter((ci) => ci.product.id !== productId);
        persistCart(next);
        syncCartToSupabase(productId, null);
        return next;
      });
    },
    [persistCart, syncCartToSupabase]
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId);
        return;
      }
      setCart((prev) => {
        const next = prev.map((ci) =>
          ci.product.id === productId ? { ...ci, quantity } : ci
        );
        persistCart(next);
        syncCartToSupabase(productId, quantity);
        return next;
      });
    },
    [persistCart, syncCartToSupabase, removeFromCart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    persistCart([]);
    if (user) {
      supabase
        .from('cart_items')
        .delete()
        .eq('userId', user.id)
        .then(
          ({ error }) => {
            if (error && __DEV__)
              console.error('[SUPABASE] Lỗi xoá giỏ hàng:', error.message);
          },
          () => {}
        );
    }
  }, [user, persistCart]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.quantity, 0),
    [cart]
  );

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
  onNewQty: (q: number) => void
): CartItem[] {
  const existing = currentCart.find((ci) => ci.product.id === product.id);
  if (existing) {
    const newQty = existing.quantity + quantity;
    onNewQty(newQty);
    return currentCart.map((ci) =>
      ci.product.id === product.id
        ? {
            ...ci,
            product,
            selectedColor: product.selectedColorName || product.color,
            selectedAccessory: product.selectedAccessoryName,
            quantity: newQty,
          }
        : ci
    );
  }
  onNewQty(quantity);
  return [
    ...currentCart,
    {
      product,
      quantity,
      selectedColor: product.selectedColorName || product.color,
      selectedAccessory: product.selectedAccessoryName,
    },
  ];
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
