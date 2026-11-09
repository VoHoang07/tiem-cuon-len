import { MOCK_PRODUCTS } from '@/data/products';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { useProducts } from '@/store/ProductContext';
import { CartItem, Product } from '@/types/product';
import { getProductColorOptionsWithCombo } from '@/utils/comboPricing';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

interface CartContextType {
  cart: CartItem[];
  cartHydrated: boolean;
  cartTotal: number;
  cartCount: number;
  addToCart: (product: Product, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemPackaging: (
    productId: string,
    enableGiftBox: boolean,
    giftCardNote?: string
  ) => void;
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

function rehydrateCartItem(ci: CartItem, catalogProducts?: Product[]): CartItem {
  if (!ci || !ci.product) return ci;
  const p = ci.product;
  const baseId = getBaseProductId(p.id, p.baseProductId);
  const parts = p.id.split('__');
  const parsedColorId = p.selectedColorId || (parts.length >= 2 ? parts[1] : undefined);
  const parsedAccessoryId = p.selectedAccessoryId || (parts.length >= 3 ? parts[2] : undefined);

  const accText = (p.selectedAccessoryName || ci.selectedAccessory || '').toLowerCase();
  const isGiftBox =
    parsedAccessoryId === 'gift_box_letter' ||
    accText.includes('hộp quà') ||
    accText.includes('quà tặng');
  const accessoryDelta = isGiftBox ? 25000 : 0;
  const resolvedAccessoryId = isGiftBox ? 'gift_box_letter' : 'no_box';
  const resolvedAccessoryName = isGiftBox
    ? 'Set Quà Tặng Đặc Biệt (+25.000₫)'
    : 'Tự dùng / Tiêu chuẩn';
  const resolvedAccessoryEmoji = isGiftBox ? '🎁' : '🛍️';
  const resolvedGiftNote = isGiftBox
    ? (p.giftCardNote ?? ci.giftCardNote ?? '')
    : undefined;

  const liveProduct = catalogProducts?.find((m) => m.id === baseId);
  const mock = MOCK_PRODUCTS.find((m) => m.id === baseId);
  const source = liveProduct || mock;
  if (!source) {
    return {
      ...ci,
      selectedColor: p.selectedColorName || p.color || ci.selectedColor,
      selectedAccessory: resolvedAccessoryName,
      giftCardNote: resolvedGiftNote,
      product: {
        ...p,
        baseProductId: baseId,
        selectedAccessoryId: resolvedAccessoryId,
        selectedAccessoryName: resolvedAccessoryName,
        selectedAccessoryEmoji: resolvedAccessoryEmoji,
        giftCardNote: resolvedGiftNote,
      },
    };
  }

  const colorOptions = getProductColorOptionsWithCombo(source);

  const colorOpt =
    colorOptions?.find((c) => c.id === parsedColorId) ||
    colorOptions?.find(
      (c) =>
        c.name.toLowerCase() ===
        (p.selectedColorName || p.color || '').trim().toLowerCase()
    ) ||
    colorOptions?.[0];

  const resolvedImage = colorOpt?.image || p.image || source.image || mock?.image || null;
  // Always prefer live catalog variant price (or base price) when available so admin price edits apply immediately
  const variantLivePrice =
    colorOpt?.price && Number(colorOpt.price) > 0
      ? Number(colorOpt.price)
      : undefined;
  const baseCatalogPrice =
    variantLivePrice ??
    (liveProduct
      ? liveProduct.price
      : source.price);
  const resolvedPrice = baseCatalogPrice + accessoryDelta;

  return {
    ...ci,
    selectedColor: p.selectedColorName || colorOpt?.name || ci.selectedColor,
    selectedAccessory: resolvedAccessoryName,
    giftCardNote: resolvedGiftNote,
    product: {
      ...p,
      baseProductId: baseId,
      name: liveProduct?.name || p.name,
      image: resolvedImage,
      price: resolvedPrice,
      isMadeToOrder: liveProduct ? liveProduct.isMadeToOrder : p.isMadeToOrder,
      selectedColorId: colorOpt?.id ?? parsedColorId,
      selectedColorName: p.selectedColorName || colorOpt?.name || p.color,
      selectedColorHex: p.selectedColorHex || colorOpt?.hex,
      selectedAccessoryId: resolvedAccessoryId,
      selectedAccessoryName: resolvedAccessoryName,
      selectedAccessoryEmoji: resolvedAccessoryEmoji,
      giftCardNote: resolvedGiftNote,
    },
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { products: catalogProducts } = useProducts();
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
          return (parsed as CartItem[]).map((ci) =>
            rehydrateCartItem(ci, catalogProducts)
          );
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [cartOwnerId, catalogProducts]);

  const persistCart = useCallback(
    (items: CartItem[]) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const compactItems = items.map((ci) => {
            if (!ci?.product) return ci;
            const { colorOptions, accessoryOptions, gallery, reviews, ...restProd } = ci.product;
            return {
              ...ci,
              product: restProd,
            };
          });
          window.localStorage.setItem(`cart_${cartOwnerId}`, JSON.stringify(compactItems));
        }
      } catch {
        // ignore
      }
    },
    [cartOwnerId]
  );

  // Keep existing cart items' prices & images in sync whenever catalogProducts updates
  useEffect(() => {
    if (!catalogProducts || catalogProducts.length === 0) return;
    setCart((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((ci) => {
        const updated = rehydrateCartItem(ci, catalogProducts);
        if (
          updated.product.price !== ci.product.price ||
          updated.product.name !== ci.product.name ||
          updated.product.image !== ci.product.image ||
          updated.product.selectedAccessoryId !== ci.product.selectedAccessoryId ||
          updated.product.selectedAccessoryName !== ci.product.selectedAccessoryName
        ) {
          changed = true;
          return updated;
        }
        return ci;
      });
      if (changed) {
        persistCart(next);
        return next;
      }
      return prev;
    });
  }, [catalogProducts, persistCart]);

  const fetchCart = useCallback(async () => {
    if (!user) return;

    let guestCart: CartItem[] = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawGuest = window.localStorage.getItem('cart_guest');
        if (rawGuest) {
          const parsed = JSON.parse(rawGuest);
          if (Array.isArray(parsed)) {
            guestCart = (parsed as CartItem[]).map((ci) =>
              rehydrateCartItem(ci, catalogProducts)
            );
          }
          window.localStorage.removeItem('cart_guest');
        }
      }
    } catch {
      // ignore
    }

    // Prefer rich localStorage cart (which preserves exact color & accessory variants)
    const localCart = hydrateCartFromStorage();
    let baseItems: CartItem[] = localCart !== null ? localCart : [];

    if (localCart === null && baseItems.length === 0) {
      const { data } = await supabase
        .from('cart_items')
        .select('productId, quantity')
        .eq('userId', user.id);

      if (data && data.length > 0) {
        const cartRows = data as { productId: string; quantity: number }[];
        const baseProductIds = [
          ...new Set(cartRows.map((r) => getBaseProductId(r.productId))),
        ];

        const missingIds = baseProductIds.filter(
          (id) => !catalogProducts.some((m) => m.id === id)
        );
        let remoteProducts: Product[] = [];
        if (missingIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select(
              'id,name,description,price,image,category,material,color,quantity,rating,tags,createdAt'
            )
            .in('id', missingIds);
          remoteProducts = (products as Product[]) ?? [];
        }

        const productMap = new Map(remoteProducts.map((p) => [p.id, p]));

        baseItems = cartRows
          .map((ci) => {
            const baseId = getBaseProductId(ci.productId);
            const live = catalogProducts.find((m) => m.id === baseId);
            const mock = MOCK_PRODUCTS.find((m) => m.id === baseId);
            const product = (live || productMap.get(baseId) || mock) as
              | Product
              | undefined;
            if (!product) return null;
            return rehydrateCartItem(
              {
                product: { ...product, id: ci.productId },
                quantity: ci.quantity,
              },
              catalogProducts
            );
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
  }, [user, persistCart, hydrateCartFromStorage, catalogProducts]);

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
      const rehydrated = rehydrateCartItem(
        {
          product,
          quantity,
          selectedColor: product.selectedColorName || product.color,
          selectedAccessory: product.selectedAccessoryName,
        },
        catalogProducts
      );

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
    [persistCart, syncCartToSupabase, catalogProducts]
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

  const updateCartItemPackaging = useCallback(
    (productId: string, enableGiftBox: boolean, giftCardNote?: string) => {
      setCart((prev) => {
        const target = prev.find((ci) => ci.product.id === productId);
        if (!target) return prev;

        const p = target.product;
        const baseId = getBaseProductId(p.id, p.baseProductId);
        const parts = p.id.split('__');
        const colorPart = p.selectedColorId || (parts.length >= 2 ? parts[1] : 'default');
        const nextAccId = enableGiftBox ? 'gift_box_letter' : 'no_box';
        const nextAccName = enableGiftBox
          ? 'Set Quà Tặng Đặc Biệt (+25.000₫)'
          : 'Tự dùng / Tiêu chuẩn';
        const nextAccEmoji = enableGiftBox ? '🎁' : '🛍️';
        const nextProductId = `${baseId}__${colorPart}__${nextAccId}`;
        const nextNote = enableGiftBox
          ? giftCardNote !== undefined
            ? giftCardNote
            : p.giftCardNote ?? target.giftCardNote ?? ''
          : undefined;

        const updatedItem = rehydrateCartItem(
          {
            ...target,
            selectedAccessory: nextAccName,
            giftCardNote: nextNote,
            product: {
              ...p,
              id: nextProductId,
              baseProductId: baseId,
              selectedAccessoryId: nextAccId,
              selectedAccessoryName: nextAccName,
              selectedAccessoryEmoji: nextAccEmoji,
              giftCardNote: nextNote,
            },
          },
          catalogProducts
        );

        let nextCart: CartItem[];
        if (nextProductId !== productId) {
          // Check if an item with nextProductId already exists in cart
          const duplicate = prev.find((ci) => ci.product.id === nextProductId);
          if (duplicate) {
            const mergedQty = duplicate.quantity + target.quantity;
            nextCart = prev
              .filter((ci) => ci.product.id !== productId)
              .map((ci) =>
                ci.product.id === nextProductId
                  ? {
                      ...updatedItem,
                      quantity: mergedQty,
                    }
                  : ci
              );
            syncCartToSupabase(productId, null);
            syncCartToSupabase(nextProductId, mergedQty);
          } else {
            nextCart = prev.map((ci) =>
              ci.product.id === productId ? updatedItem : ci
            );
            syncCartToSupabase(productId, null);
            syncCartToSupabase(nextProductId, updatedItem.quantity);
          }
        } else {
          nextCart = prev.map((ci) =>
            ci.product.id === productId ? updatedItem : ci
          );
        }

        persistCart(nextCart);
        return nextCart;
      });
    },
    [catalogProducts, persistCart, syncCartToSupabase]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    persistCart([]);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('cart_guest');
      }
    } catch {
      // ignore
    }
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

  const contextValue = useMemo(
    () => ({
      cart,
      cartHydrated,
      cartTotal,
      cartCount,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartItemPackaging,
      clearCart,
      refetchCart,
    }),
    [
      cart,
      cartHydrated,
      cartTotal,
      cartCount,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartItemPackaging,
      clearCart,
      refetchCart,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
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
