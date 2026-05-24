import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Product) => void;
  removeProduct: (id: string) => void;
  addReview: (productId: string, review: Review) => void;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  cartTotal: number;
  cartCount: number;
}

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load products từ Supabase
  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .order('createdAt', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[SUPABASE] Lỗi load sản phẩm:', error.message);
        }
        if (data) {
          setProducts(data as Product[]);
        }
        setLoaded(true);
      });
  }, []);

  // Load cart + favorites khi user đăng nhập
  useEffect(() => {
    if (!user) {
      setCart([]);
      setFavorites([]);
      return;
    }
    supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const items: CartItem[] = data
            .map((ci: any) => {
              const product = products.find((p) => p.id === ci.product_id);
              return product ? { product, quantity: ci.quantity } : null;
            })
            .filter(Boolean) as CartItem[];
          setCart(items);
        }
      });

    supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          setFavorites(data.map((f: any) => f.product_id));
        }
      });
  }, [user, products]);

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

  // ─── Cart ────────────────────────────────
  const syncCartItem = useCallback((productId: string, quantity: number | null) => {
    if (!user) return;
    if (quantity === null || quantity <= 0) {
      supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', productId).then(() => {});
    } else {
      supabase.from('cart_items').upsert({ user_id: user.id, product_id: productId, quantity }, { onConflict: 'user_id,product_id' }).then(() => {});
    }
  }, [user]);

  const addToCart = useCallback((product: Product, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        syncCartItem(product.id, newQty);
        return prev.map((ci) => ci.product.id === product.id ? { ...ci, quantity: newQty } : ci);
      }
      syncCartItem(product.id, quantity);
      return [...prev, { product, quantity }];
    });
  }, [syncCartItem]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((ci) => ci.product.id !== productId));
    syncCartItem(productId, null);
  }, [syncCartItem]);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) => prev.map((ci) => ci.product.id === productId ? { ...ci, quantity } : ci));
    syncCartItem(productId, quantity);
  }, [syncCartItem, removeFromCart]);

  const clearCart = useCallback(() => {
    if (!user) return;
    setCart([]);
    supabase.from('cart_items').delete().eq('user_id', user.id).then(() => {});
  }, [user]);

  // ─── Favorites ────────────────────────────
  const toggleFavorite = useCallback((productId: string) => {
    if (!user) return;
    setFavorites((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', productId).then(() => {});
        return prev.filter((id) => id !== productId);
      } else {
        supabase.from('favorites').insert({ user_id: user.id, product_id: productId }).then(() => {});
        return [...prev, productId];
      }
    });
  }, [user]);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
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
      }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error('useShop must be used within ShopProvider');
  }
  return ctx;
}
