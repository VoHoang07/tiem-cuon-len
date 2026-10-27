import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Product, Review } from '@/types/product';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/services/supabase';
import { MOCK_PRODUCTS } from '@/data/products';

const PAGE_SIZE = 50;
const PRODUCTS_CACHE_KEY = 'tcl_products_cache_v6';
const DELETED_IDS_KEY = 'tcl_deleted_product_ids_v1';

function getDeletedIds(): Set<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DELETED_IDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveDeletedIds(ids: Set<string>) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // ignore
  }
}

function mergeWithMockProducts(remoteOrCached: Product[]): Product[] {
  const deletedIds = getDeletedIds();
  const mockById = new Map<string, Product>();
  const mockByName = new Map<string, Product>();
  for (const mp of MOCK_PRODUCTS) {
    mockById.set(mp.id, mp);
    mockByName.set(mp.name.trim().toLowerCase(), mp);
  }

  const seenMockIds = new Set<string>();
  const merged: Product[] = [];

  for (const item of remoteOrCached) {
    if (deletedIds.has(item.id)) continue;
    const matchedMock =
      mockById.get(item.id) || mockByName.get(item.name.trim().toLowerCase());

    if (matchedMock) {
      seenMockIds.add(matchedMock.id);
      merged.push({
        ...matchedMock,
        ...item,
        // Ensure updated category, local image fallback, and rich variants from MOCK_PRODUCTS are preserved
        category: matchedMock.category,
        image: item.image || matchedMock.image,
        gallery:
          item.gallery && item.gallery.length > 0
            ? item.gallery
            : matchedMock.gallery,
        colorOptions:
          item.colorOptions && item.colorOptions.length > 0
            ? item.colorOptions
            : matchedMock.colorOptions,
        accessoryOptions:
          item.accessoryOptions && item.accessoryOptions.length > 0
            ? item.accessoryOptions
            : matchedMock.accessoryOptions,
      });
    } else {
      merged.push(item);
    }
  }

  for (const mp of MOCK_PRODUCTS) {
    if (!seenMockIds.has(mp.id) && !deletedIds.has(mp.id)) {
      merged.push(mp);
    }
  }

  return merged;
}

function loadCachedProducts(): Product[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(PRODUCTS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeWithMockProducts(parsed as Product[]);
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return mergeWithMockProducts(MOCK_PRODUCTS);
}

function saveCachedProducts(items: Product[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && items.length > 0) {
      window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore quota errors (e.g. large base64 images)
  }
}

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
  const [products, setProducts] = useState<Product[]>(() => loadCachedProducts());
  const [loaded, setLoaded] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchProducts = useCallback(async (pageNum: number = 0): Promise<Product[] | null> => {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Fast public REST fetch with 4.5s timeout so auth locks or slow connections never hang the UI
    if (supabaseUrl && supabaseAnonKey) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
      try {
        const endpoint = `${supabaseUrl}/rest/v1/products?select=*&order=createdAt.desc&offset=${from}&limit=${PAGE_SIZE}`;
        const res = await fetch(endpoint, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          signal: controller?.signal,
        });
        if (timer) clearTimeout(timer);
        if (res.ok) {
          const data = (await res.json()) as Product[];
          if (Array.isArray(data)) {
            setHasMore(data.length === PAGE_SIZE);
            return data;
          }
        }
      } catch {
        if (timer) clearTimeout(timer);
      }
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) {
        if (__DEV__) console.error('[SUPABASE] Lỗi load sản phẩm:', error.message);
        return null;
      }

      const rows = (data as Product[]) || [];
      setHasMore(rows.length === PAGE_SIZE);
      return rows;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProducts(0)
      .then((data) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          const merged = mergeWithMockProducts(data);
          setProducts(merged);
          saveCachedProducts(merged);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProducts]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    const data = await fetchProducts(nextPage);
    if (data && data.length > 0) {
      setProducts((prev) => mergeWithMockProducts([...prev, ...data]));
      setPage(nextPage);
    }
  }, [page, fetchProducts]);

  const refetchProducts = useCallback(async () => {
    setPage(0);
    const data = await fetchProducts(0);
    if (data && data.length > 0) {
      const merged = mergeWithMockProducts(data);
      setProducts(merged);
      saveCachedProducts(merged);
    }
  }, [fetchProducts]);

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => {
      const next = [product, ...prev];
      saveCachedProducts(next);
      return next;
    });
    const { isFavorite, gallery, colorOptions, accessoryOptions, ...dbProduct } = product;
    supabase.from('products').insert(dbProduct).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm sản phẩm:', error.message);
    }, () => {});
  }, []);

  const updateProduct = useCallback((id: string, product: Product) => {
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? product : p));
      saveCachedProducts(next);
      return next;
    });
    const { isFavorite, gallery, colorOptions, accessoryOptions, ...dbProduct } = product;
    supabase.from('products').update(dbProduct).eq('id', id).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi sửa sản phẩm:', error.message);
    }, () => {});
  }, []);

  const removeProduct = useCallback((id: string) => {
    const deleted = getDeletedIds();
    deleted.add(id);
    saveDeletedIds(deleted);
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveCachedProducts(next);
      return next;
    });
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
