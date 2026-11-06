import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import type { Product, CartItem, Review } from '@/types/product';
import { ProductProvider, useProducts } from '@/store/ProductContext';
import { CartProvider, useCart } from '@/store/CartContext';
import { FavoritesProvider, useFavorites } from '@/store/FavoritesContext';

interface ShopContextType {
  products: Product[];
  shopReviews: Review[];
  cart: CartItem[];
  favorites: string[];
  isLoading: boolean;
  cartHydrated: boolean;
  hasMore: boolean;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, product: Product) => Promise<void>;
  removeProduct: (id: string) => void;
  addReview: (productId: string, review: Review) => void;
  addShopReview: (review: Review) => void;
  removeShopReview: (reviewId: string) => void;
  replyToShopReview: (reviewId: string, replyText: string) => void;
  addToCart: (product: Product, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemPackaging: (
    productId: string,
    enableGiftBox: boolean,
    giftCardNote?: string
  ) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  cartTotal: number;
  cartCount: number;
  loadMore: () => Promise<void>;
  refetchCartFavorites: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  return (
    <ProductProvider>
      <CartProvider>
        <FavoritesProvider>
          <ShopBridge>{children}</ShopBridge>
        </FavoritesProvider>
      </CartProvider>
    </ProductProvider>
  );
}

function ShopBridge({ children }: { children: ReactNode }) {
  const { products, shopReviews, isLoading, hasMore, loadMore, addProduct, updateProduct, removeProduct, addReview, addShopReview, removeShopReview, replyToShopReview, refetchProducts } = useProducts();
  const { cart, cartHydrated, cartTotal, cartCount, addToCart, removeFromCart, updateCartQuantity, updateCartItemPackaging, clearCart, refetchCart } = useCart();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const refetchCartFavorites = useCallback(async () => {
    await Promise.all([refetchCart(), refetchProducts()]);
  }, [refetchCart, refetchProducts]);

  const value = useMemo(
    () => ({
      products,
      shopReviews,
      cart,
      favorites,
      isLoading,
      cartHydrated,
      hasMore,
      addProduct,
      updateProduct,
      removeProduct,
      addReview,
      addShopReview,
      removeShopReview,
      replyToShopReview,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartItemPackaging,
      clearCart,
      toggleFavorite,
      isFavorite,
      cartTotal,
      cartCount,
      loadMore,
      refetchCartFavorites,
    }),
    [
      products,
      shopReviews,
      cart,
      favorites,
      isLoading,
      cartHydrated,
      hasMore,
      addProduct,
      updateProduct,
      removeProduct,
      addReview,
      addShopReview,
      removeShopReview,
      replyToShopReview,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartItemPackaging,
      clearCart,
      toggleFavorite,
      isFavorite,
      cartTotal,
      cartCount,
      loadMore,
      refetchCartFavorites,
    ]
  );

  return (
    <ShopContext.Provider value={value}>
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
