import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Product, Review } from '@/types/product';
import { supabase } from '@/services/supabase';

const PAGE_SIZE = 20;

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Product) => void;
  removeProduct: (id: string) => void;
  addReview: (productId: string, review: Review) => void;
  refetchProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchProducts = useCallback(async (pageNum: number = 0) => {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (error) {
      if (__DEV__) console.error('[SUPABASE] Lỗi load sản phẩm:', error.message);
      return [];
    }

    setHasMore((data || []).length === PAGE_SIZE);
    return (data as Product[]) || [];
  }, []);

  useEffect(() => {
    fetchProducts(0).then((data) => {
      setProducts(data);
      setLoaded(true);
    });
  }, [fetchProducts]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    const data = await fetchProducts(nextPage);
    if (data.length > 0) {
      setProducts((prev) => [...prev, ...data]);
      setPage(nextPage);
    }
  }, [page, fetchProducts]);

  const refetchProducts = useCallback(async () => {
    setPage(0);
    const data = await fetchProducts(0);
    setProducts(data);
  }, [fetchProducts]);

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [product, ...prev]);
    const { isFavorite, ...dbProduct } = product;
    supabase.from('products').insert(dbProduct).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm sản phẩm:', error.message);
    }, () => {});
  }, []);

  const updateProduct = useCallback((id: string, product: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? product : p)));
    const { isFavorite, ...dbProduct } = product;
    supabase.from('products').update(dbProduct).eq('id', id).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi sửa sản phẩm:', error.message);
    }, () => {});
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    supabase.from('products').delete().eq('id', id).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi xoá sản phẩm:', error.message);
    }, () => {});
  }, []);

  const addReview = useCallback((productId: string, review: Review) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const newReviews = [...p.reviews, review];
        const avgRating = newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length;
        const updated = { ...p, reviews: newReviews, rating: Math.round(avgRating * 10) / 10 };
        supabase.from('products').update({ reviews: newReviews, rating: updated.rating }).eq('id', productId).then(({ error }) => {
          if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm review:', error.message);
        }, () => {});
        return updated;
      })
    );
  }, []);

  return (
    <ProductContext.Provider
      value={{
        products,
        isLoading: !loaded,
        hasMore,
        loadMore,
        addProduct,
        updateProduct,
        removeProduct,
        addReview,
        refetchProducts,
      }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProducts must be used within ProductProvider');
  return ctx;
}
