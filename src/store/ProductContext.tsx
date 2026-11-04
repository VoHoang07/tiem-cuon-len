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
import {
  sanitizeText,
  sanitizeMultilineText,
  validateReviewSchema,
} from '@/utils/schemaValidator';

const PAGE_SIZE = 250;
const PRODUCTS_CACHE_KEY = 'tcl_products_cache_v12';
const LEGACY_CACHE_KEYS = ['tcl_products_cache_v11', 'tcl_products_cache_v10'];
const CUSTOM_ADMIN_PRODUCTS_KEY = 'tcl_custom_admin_products_v1';
const DELETED_IDS_KEY = 'tcl_deleted_product_ids_v1';
const VARIANTS_META_PREFIX = '__tcl_variants_v1__:';
const COVER_IMG_REF = '__COVER__';

// In-memory map + IndexedDB + localStorage persistence so newly added/edited products NEVER disappear when syncProducts runs
const customAdminProductsMemory = new Map<string, Product>();

function saveToIdb(key: string, value: any) {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  try {
    const req = window.indexedDB.open('tcl_products_idb_v1', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction('store', 'readwrite');
        tx.objectStore('store').put(value, key);
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

function loadFromIdb(key: string): Promise<Product[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve([]);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open('tcl_products_idb_v1', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('store', 'readonly');
          const getReq = tx.objectStore('store').get(key);
          getReq.onsuccess = () => {
            resolve(Array.isArray(getReq.result) ? (getReq.result as Product[]) : []);
          };
          getReq.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function saveCustomProductsToIdb(list: Product[]) {
  saveToIdb('custom_products', list);
}

function loadCustomProductsFromIdb(): Promise<Product[]> {
  return loadFromIdb('custom_products');
}

function loadCustomAdminProductsSync(): Product[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CUSTOM_ADMIN_PRODUCTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p && p.id) customAdminProductsMemory.set(p.id, p);
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return [...customAdminProductsMemory.values()];
}

function persistCustomAdminProduct(product: Product) {
  customAdminProductsMemory.set(product.id, product);
  const all = [...customAdminProductsMemory.values()];
  saveCustomProductsToIdb(all);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CUSTOM_ADMIN_PRODUCTS_KEY, JSON.stringify(all));
    }
  } catch {
    // If localStorage hits 5MB quota, IndexedDB + memory still hold 100% of the data
  }
}

function removeCustomAdminProduct(id: string) {
  customAdminProductsMemory.delete(id);
  const all = [...customAdminProductsMemory.values()];
  saveCustomProductsToIdb(all);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CUSTOM_ADMIN_PRODUCTS_KEY, JSON.stringify(all));
    }
  } catch {
    // ignore
  }
}

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
        ? parsedMeta.colorOptions.map((c) => ({
            ...c,
            image: c.image === COVER_IMG_REF ? raw.image : c.image,
          }))
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
  'user_1779644070262',
  'user_1779641933394',
  'user_1779641892818',
  'user_1779641818466',
  'user_1779641784566',
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

  // Custom products created by Admin (id starts with user_, except the seeded user_bunny_keychain_01) are NEVER mock products
  if (
    typeof item.id === 'string' &&
    item.id.startsWith('user_') &&
    item.id !== 'user_bunny_keychain_01'
  ) {
    return undefined;
  }

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
  const seenCustomIds = new Set<string>();
  const seenCustomNames = new Set<string>();

  const localCustom = loadCustomAdminProductsSync();
  const combinedSource = [...localCustom, ...remoteOrCached];

  for (const rawItem of combinedSource) {
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
    if (!normName || seenCustomIds.has(item.id) || seenCustomNames.has(normName)) continue;
    seenCustomIds.add(item.id);
    seenCustomNames.add(normName);
    customAdminProducts.push(item);
  }

  customAdminProducts.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

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
      for (const oldKey of LEGACY_CACHE_KEYS) {
        try {
          window.localStorage.removeItem(oldKey);
        } catch {
          // ignore
        }
      }
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
  if (typeof window === 'undefined' || items.length === 0) return;
  saveToIdb('cached_all_products', items);
  if (!window.localStorage) return;
  setTimeout(() => {
    try {
      window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(items));
    } catch {
      // If full base64 variants exceed localStorage 5MB quota, save a compact summary in localStorage while IndexedDB holds the full images
      try {
        const compact = items.map((p) => ({
          ...p,
          colorOptions: Array.isArray(p.colorOptions)
            ? p.colorOptions.map((c) => ({
                ...c,
                image:
                  typeof c.image === 'string' && c.image === p.image
                    ? COVER_IMG_REF
                    : c.image,
              }))
            : p.colorOptions,
        }));
        window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(compact));
      } catch {
        // ignore
      }
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
            ? validImage && c.image === validImage
              ? COVER_IMG_REF
              : c.image
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

async function getSupabaseAuthBearer(): Promise<string> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    }
  } catch {
    // ignore
  }
  return supabaseAnonKey;
}

async function upsertProductToSupabase(dbProduct: ReturnType<typeof toDbProduct>): Promise<boolean> {
  try {
    const { error } = await supabase.from('products').upsert(dbProduct, { onConflict: 'id' });
    if (!error) return true;
  } catch {
    // fall through to REST call
  }
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const bearer = await getSupabaseAuthBearer();
      const res = await fetch(`${supabaseUrl}/rest/v1/products?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(dbProduct),
      });
      if (res.ok) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function deleteProductFromSupabase(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) return;
  } catch {
    // fall through
  }
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const bearer = await getSupabaseAuthBearer();
      await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${bearer}`,
          },
        }
      );
    } catch {
      // ignore
    }
  }
}

interface ProductContextType {
  products: Product[];
  shopReviews: Review[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
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

  // Hydrate cached and custom admin products from IndexedDB on mount in case localStorage was exceeded
  useEffect(() => {
    Promise.all([loadFromIdb('cached_all_products'), loadCustomProductsFromIdb()]).then(
      ([cachedAll, idbCustom]) => {
        const deleted = getDeletedIds();
        if (idbCustom.length > 0) {
          for (const p of idbCustom) {
            if (p && p.id && !deleted.has(p.id)) {
              customAdminProductsMemory.set(p.id, p);
            }
          }
        }
        if (cachedAll.length > 0 || idbCustom.length > 0) {
          setProducts((prev) =>
            mergeWithMockProducts(cachedAll.length > 0 ? cachedAll : prev)
          );
        }
      }
    );
  }, []);

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
    const PRODUCT_COLUMNS =
      'id,name,description,price,image,category,material,color,quantity,rating,reviews,tags,createdAt';

    // Fast public REST fetch with 15s timeout & cache: 'no-store' so mobile networks & Safari never serve stale products
    if (supabaseUrl && supabaseAnonKey) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
      try {
        const endpoint = `${supabaseUrl}/rest/v1/products?select=${PRODUCT_COLUMNS}&order=createdAt.desc&offset=${from}&limit=${PAGE_SIZE}&_t=${Date.now()}`;
        const res = await fetch(endpoint, {
          cache: 'no-store',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          signal: controller?.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as Product[];
          if (timer) clearTimeout(timer);
          if (Array.isArray(data)) {
            setHasMore(data.length === PAGE_SIZE);
            return data;
          }
        }
        if (timer) clearTimeout(timer);
      } catch {
        if (timer) clearTimeout(timer);
      }
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
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
            // If Admin has local custom products in memory/IndexedDB/localStorage that aren't in Supabase yet, push them automatically
            if (role === 'admin') {
              const remoteIds = new Set(data.map((r) => r.id));
              const deleted = getDeletedIds();
              const localCustoms = loadCustomAdminProductsSync();
              for (const lp of localCustoms) {
                if (lp && lp.id && !remoteIds.has(lp.id) && !deleted.has(lp.id)) {
                  upsertProductToSupabase(toDbProduct(lp)).catch(() => {});
                }
              }
            }
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
    const timer = setInterval(syncProducts, 30000);
    const handleFocus = () => {
      syncProducts();
    };
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncProducts();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('pageshow', handleFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('pageshow', handleFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchProducts, role]);

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

  const addProduct = useCallback(async (product: Product) => {
    if (role !== 'admin') return;
    persistCustomAdminProduct(product);
    setProducts((prev) => {
      const next = [product, ...prev.filter((p) => p.id !== product.id)];
      saveCachedProducts(next);
      return next;
    });
    const dbProduct = toDbProduct(product);
    await upsertProductToSupabase(dbProduct);
  }, [role]);

  const updateProduct = useCallback(async (id: string, product: Product) => {
    if (role !== 'admin') return;
    persistCustomAdminProduct(product);
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? product : p));
      saveCachedProducts(next);
      return next;
    });
    const dbProduct = toDbProduct(product);
    await upsertProductToSupabase(dbProduct);
  }, [role]);

  const removeProduct = useCallback((id: string) => {
    if (role !== 'admin') return;
    removeCustomAdminProduct(id);
    const deleted = getDeletedIds();
    deleted.add(id);
    saveDeletedIds(deleted);
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveCachedProducts(next);
      return next;
    });
    deleteProductFromSupabase(id).catch(() => {});
  }, [role]);

  const addReview = useCallback((productId: string, review: Review) => {
    const baseId = sanitizeText(String(productId || '').split('__')[0], 80);
    const validated = validateReviewSchema(review);
    if (!validated.success || !validated.data || !baseId) return;
    const sanitizedReview: Review = {
      id: sanitizeText(review.id || `rev_${Date.now()}`, 60),
      userName: validated.data.userName,
      rating: validated.data.rating,
      comment: validated.data.comment,
      date: sanitizeText(review.date || new Date().toLocaleDateString('vi-VN'), 30),
    };
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.id !== baseId) return p;
        const newReviews = [sanitizedReview, ...p.reviews];
        const avgRating = newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length;
        const updated = { ...p, reviews: newReviews, rating: Math.round(avgRating * 10) / 10 };
        upsertProductToSupabase(toDbProduct(updated)).catch(() => {});
        return updated;
      });
      saveCachedProducts(next);
      return next;
    });
  }, []);

  const addShopReview = useCallback((review: Review) => {
    const validated = validateReviewSchema(review);
    if (!validated.success || !validated.data) return;
    const sanitized: Review = {
      id: sanitizeText(review.id || `shop_rev_${Date.now()}`, 60),
      userName: validated.data.userName,
      rating: validated.data.rating,
      comment: validated.data.comment,
      date: sanitizeText(review.date || new Date().toLocaleDateString('vi-VN'), 30),
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
