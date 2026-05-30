import { createContext, useContext, type ReactNode } from 'react';
import type { Product, CartItem, Review } from '@/types/product';
import { ProductProvider, useProducts } from '@/store/ProductContext';
import { CartProvider, useCart } from '@/store/CartContext';
import { FavoritesProvider, useFavorites } from '@/store/FavoritesContext';

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
  const { products, isLoading, addProduct, updateProduct, removeProduct, addReview, refetchProducts } = useProducts();
  const { cart, cartHydrated, cartTotal, cartCount, addToCart, removeFromCart, updateCartQuantity, clearCart, refetchCart } = useCart();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const refetchCartFavorites = async () => {
    await Promise.all([refetchCart(), refetchProducts()]);
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        cart,
        favorites,
        isLoading,
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

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error('useShop must be used within ShopProvider');
  }
  return ctx;
}
