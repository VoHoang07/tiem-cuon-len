import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { Product, Review } from '@/types/product';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/services/supabase';
import { MOCK_PRODUCTS } from '@/data/products';
import { useAuth } from '@/store/AuthContext';

const PAGE_SIZE = 50;
const PRODUCTS_CACHE_KEY = 'tcl_products_cache_v11';
const DELETED_IDS_KEY = 'tcl_deleted_product_ids_v1';
const VARIANTS_META_PREFIX = '__tcl_variants_v1__:';

function hydrateDbProduct(raw: Product): Product {
  if (!raw || !Array.isArray(raw.tags)) return raw;
  const cleanTags: string[] = [];
  let parsedMeta: {
    colorOptions?: Product['colorOptions'];
    accessoryOptions?: Product['accessoryOptions'];
    gallery?: Product['gallery'];
    isMadeToOrder?: boolean;
  } | null = null;

  for (const tag of raw.tags) {
    if (typeof tag === 'string' && tag.startsWith(VARIANTS_META_PREFIX)) {
      try {
        parsedMeta = JSON.parse(tag.slice(VARIANTS_META_PREFIX.length));
      } catch {
        // ignore malformed metadata
      }
    } else if (typeof tag === 'string') {
      cleanTags.push(tag);
    }
  }

  if (!parsedMeta) {
    return raw;
  }

  return {
    ...raw,
    tags: cleanTags,
    colorOptions:
      Array.isArray(parsedMeta.colorOptions) && parsedMeta.colorOptions.length > 0
        ? parsedMeta.colorOptions
        : raw.colorOptions,
    accessoryOptions:
      Array.isArray(parsedMeta.accessoryOptions) &&
      parsedMeta.accessoryOptions.length > 0
        ? parsedMeta.accessoryOptions
        : raw.accessoryOptions,
    gallery:
      Array.isArray(parsedMeta.gallery) && parsedMeta.gallery.length > 0
        ? parsedMeta.gallery
        : raw.gallery,
    isMadeToOrder:
      typeof parsedMeta.isMadeToOrder === 'boolean'
        ? parsedMeta.isMadeToOrder
        : raw.isMadeToOrder,
  };
}

const RETIRED_PRODUCT_IDS = new Set([
  'keychain-duck-5',
  'yarn-mohair-4',
  'yarn-macrame-5',
  'crochet-tulip-pot-3',
  'crochet-rose-bouquet-4',
  'bag-tulip-pouch-3',
  'bag-strawberry-pouch-5',
  'doll-bunny-dress-3',
  'doll-couple-bears-5',
  'acc-fruit-hairclips-4',
  'acc-crochet-collar-5',
  'velvet_wire_tulip_01',
  'velvet_wire_puppy_keychain_02',
  'velvet_wire_lily_lamp_03',
  'velvet_wire_bear_04',
  'velvet_wire_hairclip_05',
  'velvet_wire_diy_kit_06',
]);

const LEGACY_ID_TO_MOCK_ID: Record<string, string> = {
  '1': 'bearbag-7',
  '2': 'bouquet-4',
  '3': 'cherry-1',
  '4': 'dino-5',
  '5': 'icecream-2',
  '6': 'mirror-6',
  '7': 'sunflower-3',
};

function findMatchingMockProduct(
  item: Product,
  mockById: Map<string, Product>,
  mockByName: Map<string, Product>
): Product | undefined {
  const direct = mockById.get(item.id);
  if (direct) return direct;

  const mappedLegacyId = LEGACY_ID_TO_MOCK_ID[item.id];
  if (mappedLegacyId && mockById.get(mappedLegacyId)) {
    return mockById.get(mappedLegacyId);
  }

  const normName = (item.name || '').trim().toLowerCase();
  const byExactName = mockByName.get(normName);
  if (byExactName) return byExactName;

  // Match legacy seeded names / keywords from earlier versions in Supabase
  if (normName.includes('thỏ ôm dâu') || normName.includes('thỏ tai cụp')) {
    return mockById.get('user_bunny_keychain_01');
  }
  if (normName.includes('cherry')) {
    return mockById.get('cherry-1');
  }
  if (normName.includes('kem ốc quế') || normName.includes('móc khoá kem')) {
    return mockById.get('icecream-2');
  }
  if (normName.includes('hướng dương')) {
    return mockById.get('sunflower-3');
  }
  if (
    normName.includes('bó hoa thỏ') ||
    normName.includes('bó hoa crochet pastel')
  ) {
    return mockById.get('bouquet-4');
  }
  if (normName.includes('khủng long')) {
    return mockById.get('dino-5');
  }
  if (normName.includes('gương')) {
    return mockById.get('mirror-6');
  }
  if (normName.includes('túi gấu') || normName.includes('pudding')) {
    return mockById.get('bearbag-7');
  }

  return undefined;
}

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

  const remoteReviewsByMockId = new Map<string, Review[]>();
  // Track remote overrides for mock products (price, name, description, etc.)
  const remoteOverridesByMockId = new Map<string, Partial<Product>>();
  const customAdminProducts: Product[] = [];
  const seenCustomNames = new Set<string>();

  for (const rawItem of remoteOrCached) {
    const item = hydrateDbProduct(rawItem);
    if (!item || deletedIds.has(item.id) || RETIRED_PRODUCT_IDS.has(item.id)) {
      continue;
    }

    const matchedMock = findMatchingMockProduct(item, mockById, mockByName);
    if (matchedMock) {
      if (deletedIds.has(matchedMock.id)) continue;
      if (Array.isArray(item.reviews) && item.reviews.length > 0) {
        const existing = remoteReviewsByMockId.get(matchedMock.id) || [];
        if (item.reviews.length > existing.length) {
          remoteReviewsByMockId.set(matchedMock.id, item.reviews);
        }
      }
      // Only apply admin field overrides when the remote row ID exactly matches the mock ID
      // (prevents old legacy seeded rows with different IDs from overwriting mock products)
      if (item.id === matchedMock.id) {
        const overrides: Partial<Product> = {};
        if (item.price !== undefined && Number(item.price) > 0) overrides.price = Number(item.price);
        if (item.name) overrides.name = item.name;
        if (item.description) overrides.description = item.description;
        if (item.material) overrides.material = item.material;
        if (item.color) overrides.color = item.color;
        if (Array.isArray(item.tags) && item.tags.length > 0) overrides.tags = item.tags;
        if (item.rating !== undefined) overrides.rating = item.rating;
        if (item.quantity !== undefined) overrides.quantity = item.quantity;
        if (
          typeof item.image === 'string' &&
          (item.image.startsWith('data:image/') || item.image.startsWith('http'))
        ) {
          overrides.image = item.image;
        }
        if (Array.isArray(item.colorOptions) && item.colorOptions.length > 0) {
          overrides.colorOptions = item.colorOptions.map((co, idx) => {
            const mockCo =
              matchedMock.colorOptions?.find(
                (mc) => mc.id === co.id || mc.name.toLowerCase() === co.name.toLowerCase()
              ) || matchedMock.colorOptions?.[idx];
            return {
              ...co,
              image:
                typeof co.image === 'string' &&
                (co.image.startsWith('data:image/') || co.image.startsWith('http'))
                  ? co.image
                  : mockCo?.image,
            };
          });
        }
        if (Array.isArray(item.accessoryOptions) && item.accessoryOptions.length > 0) {
          overrides.accessoryOptions = item.accessoryOptions;
        }
        if (Array.isArray(item.gallery) && item.gallery.length > 0) {
          overrides.gallery = item.gallery;
        }
        if (typeof item.isMadeToOrder === 'boolean') {
          overrides.isMadeToOrder = item.isMadeToOrder;
        }
        remoteOverridesByMockId.set(matchedMock.id, overrides);
      }
      continue;
    }

    const normName = (item.name || '').trim().toLowerCase();
    if (!normName || seenCustomNames.has(normName)) continue;
    seenCustomNames.add(normName);
    customAdminProducts.push(item);
  }

  const merged: Product[] = [...customAdminProducts];

  for (const mp of MOCK_PRODUCTS) {
    if (deletedIds.has(mp.id)) continue;
    const remoteReviews = remoteReviewsByMockId.get(mp.id);
    const remoteOverrides = remoteOverridesByMockId.get(mp.id);
    if (remoteOverrides || (remoteReviews && remoteReviews.length > 0)) {
      merged.push({
        ...mp,
        ...(remoteOverrides || {}),
        reviews: (remoteReviews && remoteReviews.length > 0) ? remoteReviews : mp.reviews,
      });
    } else {
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

function productsSignature(list: Product[]): string {
  return list
    .map(
      (p) =>
        `${p.id}:${p.name}:${p.price}:${p.quantity}:${p.isMadeToOrder !== false ? 1 : 0}:${p.rating}:${p.reviews?.length || 0}:${p.colorOptions?.length || 0}:${p.accessoryOptions?.length || 0}:${p.gallery?.length || 0}:${typeof p.image === 'string' ? p.image.length : 1}`
    )
    .join('|');
}

function saveCachedProducts(items: Product[]) {
  if (typeof window === 'undefined' || !window.localStorage || items.length === 0) return;
  setTimeout(() => {
    try {
      window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors (e.g. large base64 images)
    }
  }, 0);
}

function toDbProduct(product: Product) {
  const validImage =
    typeof product.image === 'string' && !product.image.trim().startsWith('{')
      ? product.image
      : null;

  const cleanTags = Array.isArray(product.tags)
    ? product.tags.filter(
        (t) => typeof t === 'string' && !t.startsWith(VARIANTS_META_PREFIX)
      )
    : [];

  const serializableColors = Array.isArray(product.colorOptions)
    ? product.colorOptions.map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
        image:
          typeof c.image === 'string' &&
          (c.image.startsWith('data:image/') || c.image.startsWith('http'))
            ? c.image
            : undefined,
      }))
    : undefined;

  const serializableAccessories = Array.isArray(product.accessoryOptions)
    ? product.accessoryOptions.map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        priceDelta: Number(a.priceDelta || 0),
      }))
    : undefined;

  const serializableGallery = Array.isArray(product.gallery)
    ? product.gallery
        .filter(
          (g) =>
            typeof g.image === 'string' &&
            (g.image.startsWith('data:image/') || g.image.startsWith('http'))
        )
        .map((g) => ({
          id: g.id,
          label: g.label,
          angleTag: g.angleTag,
          image: g.image,
          colorId: g.colorId,
          accessoryId: g.accessoryId,
          zoomMode: g.zoomMode,
        }))
    : undefined;

  const finalTags = [...cleanTags];
  if (
    (serializableColors && serializableColors.length > 0) ||
    (serializableAccessories && serializableAccessories.length > 0) ||
    (serializableGallery && serializableGallery.length > 0) ||
    typeof product.isMadeToOrder === 'boolean'
  ) {
    finalTags.push(
      `${VARIANTS_META_PREFIX}${JSON.stringify({
        colorOptions: serializableColors,
        accessoryOptions: serializableAccessories,
        gallery: serializableGallery,
        isMadeToOrder: product.isMadeToOrder,
      })}`
    );
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    image: validImage,
    category: product.category,
    material: product.material,
    color: product.color,
    quantity: Number(product.quantity),
    rating: Number(product.rating ?? 5),
    reviews: Array.isArray(product.reviews) ? product.reviews : [],
    tags: finalTags,
    createdAt: product.createdAt || new Date().toISOString(),
  };
}

interface ProductContextType {
  products: Product[];
  shopReviews: Review[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, product: Product) => Promise<void>;
  removeProduct: (id: string) => void;
  addReview: (productId: string, review: Review) => void;
  addShopReview: (review: Review) => void;
  refetchProducts: () => Promise<void>;
}

const SHOP_REVIEWS_CACHE_KEY = 'tcl_shop_reviews_v1';
const SHOP_REVIEWS_ROW_ID = 'tcl_shop_reviews_v1';
const SHOP_REVIEWS_PARTITION = '__TCL_SHOP_REVIEWS_V1__';
const SHOP_REVIEWS_HOLDER_USER = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';

const DEFAULT_SHOP_REVIEWS: Review[] = [
  {
    id: 'shop_rev_1',
    userId: 'khach_1',
    userName: 'Ngọc Anh',
    rating: 5,
    comment: 'Móc khóa thỏ len ở ngoài xinh hơn trong hình nhiều, đóng gói hộp quà rất chỉn chu và thơm!',
    date: '2026-10-28T10:00:00.000Z',
  },
  {
    id: 'shop_rev_2',
    userId: 'khach_2',
    userName: 'Minh Thư',
    rating: 5,
    comment: 'Shop tư vấn màu nhiệt tình, đan cực kỳ chắc tay, giao hàng đúng hẹn 10 điểm ạ.',
    date: '2026-10-30T14:30:00.000Z',
  },
];

function loadCachedShopReviews(): Review[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SHOP_REVIEWS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Review[];
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHOP_REVIEWS;
}

function saveCachedShopReviews(list: Review[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SHOP_REVIEWS_CACHE_KEY, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}

const ProductContext = createContext<ProductContextType | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => loadCachedProducts());
  const [shopReviews, setShopReviews] = useState<Review[]>(() => loadCachedShopReviews());
  const [loaded, setLoaded] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  // Sync shop reviews from Supabase partition
  useEffect(() => {
    supabase
      .from('addresses')
      .select('detailAddress')
      .eq('fullName', SHOP_REVIEWS_PARTITION)
      .limit(1)
      .then(
        ({ data }) => {
          if (data && data.length > 0 && data[0].detailAddress) {
            try {
              const parsed = JSON.parse(data[0].detailAddress);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setShopReviews(parsed);
                saveCachedShopReviews(parsed);
              }
            } catch {
              // ignore
            }
          }
        },
        () => {}
      );
  }, []);

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
    const syncProducts = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchProducts(0)
        .then((data) => {
          if (cancelled) return;
          if (data) {
            const merged = mergeWithMockProducts(data);
            setProducts((prev) => {
              if (productsSignature(merged) === productsSignature(prev)) {
                return prev;
              }
              saveCachedProducts(merged);
              return merged;
            });
          }
          setLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setLoaded(true);
        });
    };

    syncProducts();
    const timer = setInterval(syncProducts, 25000);
    const handleFocus = () => {
      syncProducts();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
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
    if (data) {
      const merged = mergeWithMockProducts(data);
      setProducts(merged);
      saveCachedProducts(merged);
    }
  }, [fetchProducts]);

  const addProduct = useCallback((product: Product) => {
    if (role !== 'admin') return;
    setProducts((prev) => {
      const next = [product, ...prev];
      saveCachedProducts(next);
      return next;
    });
    const dbProduct = toDbProduct(product);
    supabase.from('products').upsert(dbProduct, { onConflict: 'id' }).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm sản phẩm:', error.message);
    }, () => {});
  }, [role]);

  const updateProduct = useCallback(async (id: string, product: Product) => {
    if (role !== 'admin') return;
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? product : p));
      saveCachedProducts(next);
      return next;
    });
    const dbProduct = toDbProduct(product);
    try {
      const { error } = await supabase.from('products').upsert(dbProduct, { onConflict: 'id' });
      if (error) console.error('[SUPABASE] Lỗi sửa sản phẩm:', error.message);
    } catch (e) {
      console.error('[SUPABASE] Network error updating product:', e);
    }
  }, [role]);

  const removeProduct = useCallback((id: string) => {
    if (role !== 'admin') return;
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
  }, [role]);

  const addReview = useCallback((productId: string, review: Review) => {
    const baseId = String(productId || '').split('__')[0];
    const safeRating = Math.max(1, Math.min(5, Number(review.rating) || 5));
    const safeComment = String(review.comment || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const safeUserName = String(review.userName || 'Khách hàng').replace(/[<>]/g, '').trim().slice(0, 80);
    if (!safeComment || !baseId) return;
    const sanitizedReview: Review = {
      ...review,
      userName: safeUserName,
      rating: safeRating,
      comment: safeComment,
    };
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.id !== baseId) return p;
        const newReviews = [sanitizedReview, ...p.reviews];
        const avgRating = newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length;
        const updated = { ...p, reviews: newReviews, rating: Math.round(avgRating * 10) / 10 };
        supabase
          .from('products')
          .upsert(serializeForDb(updated))
          .then(({ error }) => {
            if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm review:', error.message);
          }, () => {});
        return updated;
      });
      saveCachedProducts(next);
      return next;
    });
  }, []);

  const addShopReview = useCallback((review: Review) => {
    const safeRating = Math.max(1, Math.min(5, Number(review.rating) || 5));
    const safeComment = String(review.comment || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const safeUserName = String(review.userName || 'Khách hàng').replace(/[<>]/g, '').trim().slice(0, 80);
    if (!safeComment) return;
    const sanitized: Review = {
      ...review,
      userName: safeUserName,
      rating: safeRating,
      comment: safeComment,
    };
    setShopReviews((prev) => {
      const next = [sanitized, ...prev].slice(0, 50);
      saveCachedShopReviews(next);
      supabase
        .from('addresses')
        .upsert({
          id: SHOP_REVIEWS_ROW_ID,
          userId: SHOP_REVIEWS_HOLDER_USER,
          fullName: SHOP_REVIEWS_PARTITION,
          phone: 'shop_reviews',
          city: 'HCM',
          district: 'Q8',
          ward: '1',
          detailAddress: JSON.stringify(next),
          isDefault: false,
        })
        .then(() => {}, () => {});
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      products,
      shopReviews,
      isLoading: !loaded,
      hasMore,
      loadMore,
      addProduct,
      updateProduct,
      removeProduct,
      addReview,
      addShopReview,
      refetchProducts,
    }),
    [
      products,
      shopReviews,
      loaded,
      hasMore,
      loadMore,
      addProduct,
      updateProduct,
      removeProduct,
      addReview,
      addShopReview,
      refetchProducts,
    ]
  );

  return (
    <ProductContext.Provider value={contextValue}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error('useProducts must be used within ProductProvider');
  return ctx;
}
