import { MOCK_PRODUCTS } from '@/data/products';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { Product, Review, ShopCategoryItem } from '@/types/product';
import {
    DEFAULT_SHOP_CATEGORIES,
    setDynamicCategoriesRegistry,
} from '@/utils/getCategoryEmoji';
import {
    sanitizeMultilineText,
    sanitizeText,
    validateReviewSchema,
} from '@/utils/schemaValidator';
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

const PAGE_SIZE = 250;
const PRODUCTS_CACHE_KEY = 'tcl_products_cache_v12';
const LEGACY_CACHE_KEYS = ['tcl_products_cache_v11', 'tcl_products_cache_v10'];
const CUSTOM_ADMIN_PRODUCTS_KEY = 'tcl_custom_admin_products_v1';
const DELETED_IDS_KEY = 'tcl_deleted_product_ids_v1';
const DELETED_PRODUCTS_ROW_ID = 'tcl_deleted_products_v1';
const DELETED_PRODUCTS_PARTITION = '__TCL_CHAT_MSG_V1__';
const VARIANTS_META_PREFIX = '__tcl_variants_v1__:';
const COVER_IMG_REF = '__COVER__';

// In-memory map + IndexedDB + localStorage persistence so newly added/edited/deleted products NEVER disappear or reappear when syncProducts or Vercel redeploy runs
const customAdminProductsMemory = new Map<string, Product>();
const deletedIdsMemory = new Set<string>();
const hydratedMediaMemory = new Map<
  string,
  {
    image?: Product['image'];
    colorOptions?: Product['colorOptions'];
    accessoryOptions?: Product['accessoryOptions'];
    gallery?: Product['gallery'];
    isMadeToOrder?: boolean;
    cleanTags?: string[];
    coverChecked?: boolean;
    tagsChecked?: boolean;
  }
>();

function cacheProductMediaInMemory(
  p: Product,
  opts?: { coverChecked?: boolean; tagsChecked?: boolean }
) {
  if (!p || !p.id) return;
  const hasImage =
    (typeof p.image === 'string' && p.image.length > 0) ||
    typeof p.image === 'number' ||
    (typeof p.image === 'object' && p.image !== null);
  const hasColors =
    Array.isArray(p.colorOptions) && p.colorOptions.length > 0;
  const prev = hydratedMediaMemory.get(p.id);
  if (hasImage || hasColors || opts?.coverChecked || opts?.tagsChecked || prev) {
    hydratedMediaMemory.set(p.id, {
      image: hasImage ? p.image : prev?.image,
      colorOptions: hasColors ? p.colorOptions : prev?.colorOptions,
      accessoryOptions: p.accessoryOptions || prev?.accessoryOptions,
      gallery: p.gallery || prev?.gallery,
      isMadeToOrder:
        typeof p.isMadeToOrder === 'boolean'
          ? p.isMadeToOrder
          : prev?.isMadeToOrder,
      cleanTags: Array.isArray(p.tags)
        ? p.tags.filter(
            (t) => typeof t === 'string' && !t.startsWith(VARIANTS_META_PREFIX)
          )
        : prev?.cleanTags,
      coverChecked: Boolean(opts?.coverChecked || hasImage || prev?.coverChecked),
      tagsChecked: Boolean(opts?.tagsChecked || hasColors || prev?.tagsChecked),
    });
  }
}

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
  cacheProductMediaInMemory(product);
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
  const hadCustom = customAdminProductsMemory.delete(id);
  hydratedMediaMemory.delete(id);
  if (!hadCustom) return;
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
  if (!raw) return raw;
  const cachedMedia = hydratedMediaMemory.get(raw.id);

  if (!Array.isArray(raw.tags)) {
    const merged: Product = cachedMedia
      ? {
          ...raw,
          image: raw.image || cachedMedia.image || null,
          tags: cachedMedia.cleanTags || [],
          colorOptions: raw.colorOptions || cachedMedia.colorOptions,
          accessoryOptions: raw.accessoryOptions || cachedMedia.accessoryOptions,
          gallery: raw.gallery || cachedMedia.gallery,
          isMadeToOrder:
            typeof raw.isMadeToOrder === 'boolean'
              ? raw.isMadeToOrder
              : cachedMedia.isMadeToOrder,
        }
      : raw;
    cacheProductMediaInMemory(merged);
    return merged;
  }

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

  const resolvedImage = raw.image || cachedMedia?.image || null;

  if (!parsedMeta) {
    const fallback: Product = {
      ...raw,
      image: resolvedImage,
      tags: cleanTags.length > 0 ? cleanTags : cachedMedia?.cleanTags || [],
      colorOptions: raw.colorOptions || cachedMedia?.colorOptions,
      accessoryOptions: raw.accessoryOptions || cachedMedia?.accessoryOptions,
      gallery: raw.gallery || cachedMedia?.gallery,
      isMadeToOrder:
        typeof raw.isMadeToOrder === 'boolean'
          ? raw.isMadeToOrder
          : cachedMedia?.isMadeToOrder,
    };
    cacheProductMediaInMemory(fallback);
    return fallback;
  }

  const hydrated: Product = {
    ...raw,
    image: resolvedImage,
    tags: cleanTags,
    colorOptions:
      Array.isArray(parsedMeta.colorOptions) && parsedMeta.colorOptions.length > 0
        ? parsedMeta.colorOptions.map((c) => ({
            ...c,
            image: c.image === COVER_IMG_REF ? resolvedImage : c.image,
          }))
        : raw.colorOptions || cachedMedia?.colorOptions,
    accessoryOptions:
      Array.isArray(parsedMeta.accessoryOptions) &&
      parsedMeta.accessoryOptions.length > 0
        ? parsedMeta.accessoryOptions
        : raw.accessoryOptions || cachedMedia?.accessoryOptions,
    gallery:
      Array.isArray(parsedMeta.gallery) && parsedMeta.gallery.length > 0
        ? parsedMeta.gallery
        : raw.gallery || cachedMedia?.gallery,
    isMadeToOrder:
      typeof parsedMeta.isMadeToOrder === 'boolean'
        ? parsedMeta.isMadeToOrder
        : raw.isMadeToOrder ?? cachedMedia?.isMadeToOrder,
  };
  cacheProductMediaInMemory(hydrated);
  return hydrated;
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
  'user_1793815534368',
  'user_1793811029163',
  'user_1793809418221',
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
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (typeof id === 'string' && id.trim()) {
              deletedIdsMemory.add(id.trim());
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return new Set(deletedIdsMemory);
}

function saveDeletedIds(ids: Set<string>) {
  for (const id of ids) {
    if (typeof id === 'string' && id.trim()) {
      deletedIdsMemory.add(id.trim());
    }
  }
  const arr = [...deletedIdsMemory];
  saveToIdb('deleted_product_ids', arr);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
      } catch {
        // Free up space in localStorage if large product cache caused QuotaExceededError
        try {
          window.localStorage.removeItem(PRODUCTS_CACHE_KEY);
          window.localStorage.removeItem(CUSTOM_ADMIN_PRODUCTS_KEY);
          window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(arr));
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

async function syncDeletedIdsToSupabase(ids: Set<string>): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return;
  const arr = [...ids].filter((id) => typeof id === 'string' && id.trim().length > 0);
  const payload = {
    id: DELETED_PRODUCTS_ROW_ID,
    userId: SHOP_REVIEWS_HOLDER_USER,
    fullName: DELETED_PRODUCTS_PARTITION,
    phone: '__TCL_DELETED_PRODUCTS_V1__',
    city: 'HCM',
    district: 'Q8',
    ward: '1',
    detailAddress: JSON.stringify(arr),
    isDefault: false,
  };
  try {
    const bearer = await getSupabaseAuthBearer();
    const res = await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
  } catch {
    // fall through to anon key
  }
  try {
    await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}

async function fetchRemoteDeletedIds(): Promise<string[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/addresses?id=eq.${DELETED_PRODUCTS_ROW_ID}&select=detailAddress`,
      {
        cache: 'no-store',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.detailAddress) {
      const parsed = JSON.parse(rows[0].detailAddress);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === 'string' && x.trim().length > 0);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function isValidOverridableImage(img: unknown): img is string {
  return (
    typeof img === 'string' &&
    (img.startsWith('data:image/') || img.startsWith('http'))
  );
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
        if (isValidOverridableImage(item.image)) {
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
              image: isValidOverridableImage(co.image)
                ? co.image
                : mockCo?.image || matchedMock.image,
            };
          });
        }
        if (Array.isArray(item.accessoryOptions) && item.accessoryOptions.length > 0) {
          overrides.accessoryOptions = item.accessoryOptions;
        }
        if (Array.isArray(item.gallery) && item.gallery.length > 0) {
          overrides.gallery = item.gallery.map((g, idx) => {
            const mockG =
              matchedMock.gallery?.find((mg) => mg.id === g.id) ||
              matchedMock.gallery?.[idx];
            return {
              ...g,
              image: isValidOverridableImage(g.image)
                ? g.image
                : mockG?.image || matchedMock.image,
            };
          });
        }
        if (typeof item.isMadeToOrder === 'boolean') {
          overrides.isMadeToOrder = item.isMadeToOrder;
        }
        remoteOverridesByMockId.set(matchedMock.id, overrides);
      }
      continue;
    }

    const normName = (item.name || '').trim().toLowerCase();
    if (!normName || seenCustomIds.has(item.id)) continue;
    if (seenCustomNames.has(normName)) {
      const existingIdx = customAdminProducts.findIndex(
        (existing) => (existing.name || '').trim().toLowerCase() === normName
      );
      if (existingIdx !== -1) {
        const existingItem = customAdminProducts[existingIdx];
        const existingRichness =
          (existingItem.colorOptions?.filter((c) => Boolean(c.image)).length || 0) * 10 +
          (existingItem.colorOptions?.length || 0) +
          (existingItem.image ? 5 : 0);
        const nextRichness =
          (item.colorOptions?.filter((c) => Boolean(c.image)).length || 0) * 10 +
          (item.colorOptions?.length || 0) +
          (item.image ? 5 : 0);
        if (nextRichness > existingRichness) {
          seenCustomIds.add(item.id);
          customAdminProducts[existingIdx] = item;
        }
      }
      continue;
    }
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
        `${p.id}:${p.name}:${p.price}:${p.quantity}:${p.isMadeToOrder !== false ? 1 : 0}:${p.rating}:${p.reviews?.length || 0}:${p.colorOptions?.map((c) => `${c.id}_${c.name}_${c.price || ''}`).join(',') || 0}:${p.accessoryOptions?.length || 0}:${p.gallery?.length || 0}:${typeof p.image === 'string' ? p.image.length : 1}`
    )
    .join('|');
}

let saveCacheDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function saveCachedProducts(items: Product[]) {
  if (typeof window === 'undefined' || items.length === 0) return;
  if (saveCacheDebounceTimer) {
    clearTimeout(saveCacheDebounceTimer);
  }
  // Debounce IndexedDB + localStorage persistence so multi-chunk hydration never triggers
  // 10+ simultaneous 25MB structured-clone allocations on Mobile Safari / WebView
  saveCacheDebounceTimer = setTimeout(() => {
    saveCacheDebounceTimer = null;
    saveToIdb('cached_all_products', items);
    if (!window.localStorage) return;
    try {
      // Only store lightweight metadata in localStorage (<20KB) so localStorage NEVER hits 5MB QuotaExceededError
      // and never blocks saving tcl_deleted_product_ids_v1 or Supabase auth tokens
      const lightweight = items.map((p) => ({
        ...p,
        image: isValidOverridableImage(p.image) && !p.image.startsWith('data:image/')
          ? p.image
          : undefined,
        colorOptions: Array.isArray(p.colorOptions)
          ? p.colorOptions.map((c) => ({
              ...c,
              image:
                isValidOverridableImage(c.image) && !c.image.startsWith('data:image/')
                  ? c.image
                  : undefined,
            }))
          : p.colorOptions,
        gallery: undefined,
      }));
      window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(lightweight));
    } catch {
      // ignore
    }
  }, 900);
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
        price:
          c.price !== undefined && Number(c.price) > 0
            ? Number(c.price)
            : Number(product.price) > 0
            ? Number(product.price)
            : undefined,
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
  shopCategories: ShopCategoryItem[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, product: Product) => Promise<void>;
  removeProduct: (id: string) => void;
  addReview: (productId: string, review: Review) => void;
  addShopReview: (review: Review) => void;
  removeShopReview: (reviewId: string) => void;
  replyToShopReview: (reviewId: string, replyText: string) => void;
  addShopCategory: (input: {
    label: string;
    emoji?: string;
    craftLine: 'len' | 'kem_nhung';
  }) => ShopCategoryItem | null;
  removeShopCategory: (categoryId: string) => void;
  resetShopCategories: () => void;
  refetchProducts: () => Promise<void>;
  importProductsFromRawData: (rawText: string) => Promise<number>;
}

const SHOP_CATEGORIES_CACHE_KEY = 'tcl_shop_categories_v1';
const SHOP_CATEGORIES_ROW_ID = 'tcl_shop_categories_v1';

function normalizeShopCategories(raw: unknown): ShopCategoryItem[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SHOP_CATEGORIES];
  const out: ShopCategoryItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id || '').trim();
    const label = sanitizeText(obj.label, 40);
    const emoji = sanitizeText(obj.emoji || '🧶', 8) || '🧶';
    const craftLine = obj.craftLine === 'kem_nhung' ? 'kem_nhung' : 'len';
    if (!id || !label || id === 'All' || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label, emoji, craftLine });
  }
  if (out.length === 0) return [...DEFAULT_SHOP_CATEGORIES];
  setDynamicCategoriesRegistry(out);
  return out;
}

function loadCachedShopCategories(): ShopCategoryItem[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SHOP_CATEGORIES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalizeShopCategories(parsed);
      }
    }
  } catch {
    // ignore
  }
  setDynamicCategoriesRegistry(DEFAULT_SHOP_CATEGORIES);
  return [...DEFAULT_SHOP_CATEGORIES];
}

function saveCachedShopCategories(list: ShopCategoryItem[]) {
  const cleaned = normalizeShopCategories(list);
  saveToIdb('shop_categories', cleaned);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SHOP_CATEGORIES_CACHE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // ignore
  }
}

async function syncShopCategoriesToSupabase(list: ShopCategoryItem[]): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return;
  const cleaned = normalizeShopCategories(list);
  const payload = {
    id: SHOP_CATEGORIES_ROW_ID,
    userId: SHOP_REVIEWS_HOLDER_USER,
    fullName: SHOP_REVIEWS_PARTITION,
    phone: '__TCL_SHOP_CATEGORIES_V1__',
    city: 'HCM',
    district: 'Q8',
    ward: '1',
    detailAddress: JSON.stringify(cleaned),
    isDefault: false,
  };
  try {
    const bearer = await getSupabaseAuthBearer();
    const res = await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
  } catch {
    // fall through
  }
  try {
    await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}

async function fetchRemoteShopCategories(): Promise<ShopCategoryItem[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/addresses?id=eq.${SHOP_CATEGORIES_ROW_ID}&select=detailAddress`,
      {
        cache: 'no-store',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.detailAddress) {
      const parsed = JSON.parse(rows[0].detailAddress);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeShopCategories(parsed);
      }
    }
    return null;
  } catch {
    return null;
  }
}

const RESCUE_PRODUCT_PHONE_TAG = '__TCL_RESCUE_PROD_V1__';

async function pushRescuedProductToSupabase(product: Product): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey || !product?.id) return;
  const dbProd = toDbProduct(product);
  const payload = {
    id: `tcl_rescue_${product.id}`,
    userId: SHOP_REVIEWS_HOLDER_USER,
    fullName: SHOP_REVIEWS_PARTITION,
    phone: RESCUE_PRODUCT_PHONE_TAG,
    city: 'HCM',
    district: 'Q8',
    ward: '1',
    detailAddress: JSON.stringify(dbProd),
    isDefault: false,
  };
  try {
    await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}

async function fetchRemoteRescuedProducts(): Promise<Product[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/addresses?phone=eq.${RESCUE_PRODUCT_PHONE_TAG}&select=id,detailAddress`,
      {
        cache: 'no-store',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    const rescued: Product[] = [];
    for (const row of rows) {
      if (row?.detailAddress) {
        try {
          const parsed = JSON.parse(row.detailAddress);
          if (parsed && parsed.id && parsed.name) {
            rescued.push(hydrateDbProduct(parsed as Product));
          }
        } catch {
          // ignore
        }
      }
    }
    return rescued;
  } catch {
    return [];
  }
}

function parseRfc4180Csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

function parseImportedProductsRaw(rawText: string): Product[] {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return [];
  const results: Product[] = [];

  const pushRawObj = (obj: Record<string, any>) => {
    if (!obj || typeof obj !== 'object') return;
    const id = String(obj.id || '').trim();
    const name = String(obj.name || '').trim();
    if (!id || !name || RETIRED_PRODUCT_IDS.has(id)) return;
    let parsedTags: string[] = [];
    if (Array.isArray(obj.tags)) {
      parsedTags = obj.tags;
    } else if (typeof obj.tags === 'string' && obj.tags.trim()) {
      const tStr = obj.tags.trim();
      try {
        const j = JSON.parse(tStr);
        if (Array.isArray(j)) parsedTags = j;
      } catch {
        // Handle Postgres array literal {"a","b"} if exported in Postgres format
        if (tStr.startsWith('{') && tStr.endsWith('}')) {
          const inner = tStr.slice(1, -1);
          const cells = parseRfc4180Csv(inner);
          if (cells[0]) parsedTags = cells[0];
        }
      }
    }
    let parsedReviews: Review[] = [];
    if (Array.isArray(obj.reviews)) {
      parsedReviews = obj.reviews;
    } else if (typeof obj.reviews === 'string' && obj.reviews.trim()) {
      try {
        const r = JSON.parse(obj.reviews.trim());
        if (Array.isArray(r)) parsedReviews = r;
      } catch {
        // ignore
      }
    }
    const rawProd: Product = {
      id,
      name,
      description: String(obj.description || ''),
      price: Number(obj.price || 0),
      image: obj.image || null,
      category: (obj.category || 'Keychains') as Product['category'],
      material: String(obj.material || 'Len milk cotton'),
      color: String(obj.color || 'Nhiều màu'),
      quantity: Number(obj.quantity ?? 10),
      rating: Number(obj.rating ?? 5),
      reviews: parsedReviews,
      tags: parsedTags,
      colorOptions: Array.isArray(obj.colorOptions) ? obj.colorOptions : undefined,
      accessoryOptions: Array.isArray(obj.accessoryOptions) ? obj.accessoryOptions : undefined,
      gallery: Array.isArray(obj.gallery) ? obj.gallery : undefined,
      isMadeToOrder: typeof obj.isMadeToOrder === 'boolean' ? obj.isMadeToOrder : undefined,
      createdAt: String(obj.createdAt || obj.created_at || new Date().toISOString()),
    };
    results.push(hydrateDbProduct(rawProd));
  };

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [parsed];
      for (const item of arr) {
        pushRawObj(item);
      }
      return results;
    } catch {
      // fall through to CSV parser
    }
  }

  const csvRows = parseRfc4180Csv(trimmed);
  if (csvRows.length < 2) return results;
  const headers = csvRows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  for (let r = 1; r < csvRows.length; r++) {
    const cells = csvRows[r];
    const obj: Record<string, any> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cells[c] ?? '';
    }
    pushRawObj(obj);
  }
  return results;
}

const SHOP_REVIEWS_CACHE_KEY = 'tcl_shop_reviews_v2';
const LEGACY_SHOP_REVIEWS_CACHE_KEY = 'tcl_shop_reviews_v1';
const SHOP_REVIEWS_ROW_ID = 'tcl_shop_reviews_v2';
const SHOP_REVIEWS_PARTITION = '__TCL_CHAT_MSG_V1__';
const SHOP_REVIEWS_HOLDER_USER = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';
const FAKE_SHOP_REVIEW_IDS = new Set(['shop_rev_1', 'shop_rev_2']);

function filterRealShopReviews(list: unknown): Review[] {
  if (!Array.isArray(list)) return [];
  return (list as Review[]).filter(
    (r) =>
      r &&
      typeof r.id === 'string' &&
      !FAKE_SHOP_REVIEW_IDS.has(r.id) &&
      typeof r.comment === 'string' &&
      r.comment.trim().length > 0
  );
}

function loadCachedShopReviews(): Review[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(LEGACY_SHOP_REVIEWS_CACHE_KEY);
      } catch {
        // ignore
      }
      const raw = window.localStorage.getItem(SHOP_REVIEWS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return filterRealShopReviews(parsed);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCachedShopReviews(list: Review[]) {
  const cleaned = filterRealShopReviews(list);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SHOP_REVIEWS_CACHE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // ignore
  }
}

async function syncShopReviewsToSupabase(list: Review[]): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return;
  const cleaned = filterRealShopReviews(list);
  const payload = {
    id: SHOP_REVIEWS_ROW_ID,
    userId: SHOP_REVIEWS_HOLDER_USER,
    fullName: SHOP_REVIEWS_PARTITION,
    phone: '__TCL_SHOP_REVIEWS_V2__',
    city: 'HCM',
    district: 'Q8',
    ward: '1',
    detailAddress: JSON.stringify(cleaned),
    isDefault: false,
  };
  try {
    await fetch(`${supabaseUrl}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}

async function fetchRemoteShopReviews(): Promise<Review[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/addresses?id=eq.${SHOP_REVIEWS_ROW_ID}&select=detailAddress`,
      {
        cache: 'no-store',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.detailAddress) {
      const parsed = JSON.parse(rows[0].detailAddress);
      return filterRealShopReviews(parsed);
    }
    return [];
  } catch {
    return null;
  }
}

const ProductContext = createContext<ProductContextType | null>(null);

export function ProductProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>(() => loadCachedProducts());
  const [shopReviews, setShopReviews] = useState<Review[]>(() => loadCachedShopReviews());
  const [shopCategories, setShopCategories] = useState<ShopCategoryItem[]>(() =>
    loadCachedShopCategories()
  );
  const [loaded, setLoaded] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const idbHydrationPromiseRef = useRef<Promise<void> | null>(null);

  // Sync shop categories from IndexedDB & Supabase partition
  useEffect(() => {
    let mounted = true;
    loadFromIdb('shop_categories')
      .then((idbCats) => {
        if (!mounted || !Array.isArray(idbCats) || idbCats.length === 0) return;
        const normalized = normalizeShopCategories(idbCats);
        setShopCategories(normalized);
      })
      .catch(() => {});
    fetchRemoteShopCategories().then((remoteCats) => {
      if (!mounted || !remoteCats) return;
      setShopCategories(remoteCats);
      saveCachedShopCategories(remoteCats);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Hydrate cached, custom admin products, and deleted IDs from IndexedDB on mount
  useEffect(() => {
    const p = Promise.all([
      loadFromIdb('cached_all_products'),
      loadCustomProductsFromIdb(),
      loadFromIdb('deleted_product_ids') as unknown as Promise<string[]>,
    ])
      .then(([cachedAll, idbCustom, idbDeleted]) => {
        if (Array.isArray(idbDeleted) && idbDeleted.length > 0) {
          const mergedDeleted = getDeletedIds();
          for (const id of idbDeleted) {
            if (typeof id === 'string' && id.trim()) {
              mergedDeleted.add(id.trim());
            }
          }
          saveDeletedIds(mergedDeleted);
        }
        const deleted = getDeletedIds();
        let rescuedFromCache = false;
        if (cachedAll.length > 0) {
          for (const item of cachedAll) {
            if (
              item &&
              item.id &&
              !deleted.has(item.id) &&
              !RETIRED_PRODUCT_IDS.has(item.id)
            ) {
              cacheProductMediaInMemory(item, {
                coverChecked: Boolean(item.image),
                tagsChecked: true,
              });
              // Rescue any custom user_ product from cached_all_products into customAdminProductsMemory
              if (
                typeof item.id === 'string' &&
                item.id.startsWith('user_') &&
                item.id !== 'user_bunny_keychain_01'
              ) {
                const existing = customAdminProductsMemory.get(item.id);
                if (!existing || (!existing.image && item.image)) {
                  customAdminProductsMemory.set(item.id, item);
                  rescuedFromCache = true;
                }
              }
            }
          }
        }
        if (idbCustom.length > 0) {
          for (const item of idbCustom) {
            if (
              item &&
              item.id &&
              !deleted.has(item.id) &&
              !RETIRED_PRODUCT_IDS.has(item.id)
            ) {
              customAdminProductsMemory.set(item.id, item);
              cacheProductMediaInMemory(item, {
                coverChecked: Boolean(item.image),
                tagsChecked: true,
              });
            }
          }
        }
        if (rescuedFromCache && customAdminProductsMemory.size > 0) {
          saveCustomProductsToIdb([...customAdminProductsMemory.values()]);
        }
        setProducts((prev) =>
          mergeWithMockProducts(cachedAll.length > 0 ? cachedAll : prev)
        );
      })
      .catch(() => {});
    idbHydrationPromiseRef.current = p;
  }, []);

  // Sync shop reviews from Supabase partition
  useEffect(() => {
    let mounted = true;
    fetchRemoteShopReviews().then((remoteReviews) => {
      if (!mounted || remoteReviews === null) return;
      setShopReviews(remoteReviews);
      saveCachedShopReviews(remoteReviews);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const hydrateMissingProductMedia = useCallback(
    async (baseRows: Product[]) => {
      if (!supabaseUrl || !supabaseAnonKey || !Array.isArray(baseRows)) return;

      // Wait briefly for local IndexedDB cache hydration (< 30ms) so already-cached images render in 0ms without re-downloading over mobile network
      if (idbHydrationPromiseRef.current) {
        try {
          await Promise.race([
            idbHydrationPromiseRef.current,
            new Promise((r) => setTimeout(r, 250)),
          ]);
        } catch {
          // ignore
        }
      }

      const deleted = getDeletedIds();
      // Prioritize featured products (rating >= 4.8) first so above-the-fold mobile screen renders images immediately
      // Skip legacy numeric IDs (1..7) since they are superseded by MOCK_PRODUCTS
      const activeRows = [...baseRows]
        .filter(
          (r) =>
            r &&
            r.id &&
            !deleted.has(r.id) &&
            !RETIRED_PRODUCT_IDS.has(r.id) &&
            !LEGACY_ID_TO_MOCK_ID[r.id]
        )
        .sort((a, b) => (b.rating >= 4.8 ? 1 : 0) - (a.rating >= 4.8 ? 1 : 0));

      // PASS 1: Fast Cover Photo Hydration (`select=id,image` ONLY, skipping multi-MB `tags` variant galleries)
      const missingCoverIds = activeRows
        .filter((r) => {
          const cached = hydratedMediaMemory.get(r.id);
          return !cached || (!cached.image && !cached.coverChecked);
        })
        .map((r) => r.id);

      if (missingCoverIds.length > 0) {
        const COVER_CHUNK = 3;
        const coverChunks: string[][] = [];
        for (let i = 0; i < missingCoverIds.length; i += COVER_CHUNK) {
          coverChunks.push(missingCoverIds.slice(i, i + COVER_CHUNK));
        }

        // Run 2 concurrent workers for fast cover image loading on mobile
        let cursor = 0;
        let coverUpdated = false;
        const runCoverWorker = async () => {
          while (cursor < coverChunks.length) {
            const chunkIdx = cursor++;
            const chunk = coverChunks[chunkIdx];
            if (!chunk || chunk.length === 0) continue;
            const inFilter = chunk.map((id) => encodeURIComponent(id)).join(',');
            try {
              const res = await fetch(
                `${supabaseUrl}/rest/v1/products?select=id,image&id=in.(${inFilter})`,
                {
                  headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${supabaseAnonKey}`,
                  },
                }
              );
              if (res.ok) {
                const rows = (await res.json()) as Array<{
                  id: string;
                  image?: Product['image'];
                }>;
                if (Array.isArray(rows) && rows.length > 0) {
                  for (const mr of rows) {
                    const target = baseRows.find((b) => b.id === mr.id);
                    if (target) {
                      if (mr.image) target.image = mr.image;
                      const hydrated = hydrateDbProduct(target);
                      cacheProductMediaInMemory(hydrated, { coverChecked: true });
                      coverUpdated = true;
                    }
                  }
                  // Render above-the-fold cover photos immediately on first chunk, then batch the rest
                  if (chunkIdx <= 1) {
                    setProducts(mergeWithMockProducts(baseRows));
                  }
                }
              }
            } catch {
              // continue next chunk
            }
          }
        };
        await Promise.all([runCoverWorker(), runCoverWorker()]);
        if (coverUpdated) {
          setProducts(mergeWithMockProducts(baseRows));
        }
        }

        // PASS 2: Background Variant & Gallery Hydration (`select=id,tags` ONLY — never re-download `image`!)
        const missingVariantIds = activeRows
        .filter((r) => {
          const cached = hydratedMediaMemory.get(r.id);
          return !cached || !cached.tagsChecked;
        })
        .map((r) => r.id);

        if (missingVariantIds.length === 0) return;

        const VARIANT_CHUNK = 2;
        let variantsUpdated = false;
        for (let i = 0; i < missingVariantIds.length; i += VARIANT_CHUNK) {
        const chunk = missingVariantIds.slice(i, i + VARIANT_CHUNK);
        const inFilter = chunk.map((id) => encodeURIComponent(id)).join(',');
        try {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/products?select=id,tags&id=in.(${inFilter})`,
            {
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
            }
          );
          if (res.ok) {
            const mediaRows = (await res.json()) as Array<{
              id: string;
              tags?: string[];
            }>;
            if (Array.isArray(mediaRows) && mediaRows.length > 0) {
              for (const mr of mediaRows) {
                const target = baseRows.find((b) => b.id === mr.id);
                if (target) {
                  target.tags = mr.tags ?? target.tags;
                  const hydrated = hydrateDbProduct(target);
                  cacheProductMediaInMemory(hydrated, {
                    coverChecked: true,
                    tagsChecked: true,
                  });
                  variantsUpdated = true;
                }
              }
            }
          }
        } catch {
          // continue next chunk
        }
        // Give mobile browser GC 60ms breathing room between multi-MB variant chunks to prevent WebKit OOM crash
        await new Promise((r) => setTimeout(r, 60));
        }

        if (variantsUpdated) {
        const merged = mergeWithMockProducts(baseRows);
        setProducts(merged);
        saveCachedProducts(merged);
        }
    },
    []
  );

  const fetchProducts = useCallback(
    async (pageNum: number = 0): Promise<Product[] | null> => {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      // Stage 1: Fetch lightweight catalog metadata (~4 KB, < 0.5s on mobile) without multi-MB Base64 blobs
      const METADATA_COLUMNS =
        'id,name,description,price,category,material,color,quantity,rating,reviews,createdAt';

      if (supabaseUrl && supabaseAnonKey) {
        const controller =
          typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller
          ? setTimeout(() => controller.abort(), 12000)
          : null;
        try {
          const endpoint = `${supabaseUrl}/rest/v1/products?select=${METADATA_COLUMNS}&order=createdAt.desc&offset=${from}&limit=${PAGE_SIZE}`;
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
              // Kick off Stage 2 progressive media hydration in small 2-item chunks without blocking catalog display
              void hydrateMissingProductMedia(data);
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
          .select(METADATA_COLUMNS)
          .order('createdAt', { ascending: false })
          .range(from, to);

        if (error) {
          if (__DEV__)
            console.error('[SUPABASE] Lỗi load sản phẩm:', error.message);
          return null;
        }

        const rows = (data as Product[]) || [];
        setHasMore(rows.length === PAGE_SIZE);
        void hydrateMissingProductMedia(rows);
        return rows;
      } catch {
        return null;
      }
    },
    [hydrateMissingProductMedia]
  );

  useEffect(() => {
    let cancelled = false;
    const syncProducts = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      // Wait for IndexedDB hydration so customAdminProductsMemory and cached_all_products are NEVER overwritten prematurely
      if (idbHydrationPromiseRef.current) {
        try {
          await idbHydrationPromiseRef.current;
        } catch {
          // ignore
        }
      }
      if (cancelled) return;

      try {
        const [data, remoteDeletedList, remoteRescuedList] = await Promise.all([
          fetchProducts(0),
          fetchRemoteDeletedIds(),
          fetchRemoteRescuedProducts(),
        ]);
        if (cancelled) return;

        const currentDeleted = getDeletedIds();
        let hasNewLocalDeletesToPush = false;
        const remoteDeletedSet = new Set(remoteDeletedList);
        for (const rId of remoteDeletedList) {
          if (!currentDeleted.has(rId)) {
            currentDeleted.add(rId);
            removeCustomAdminProduct(rId);
          }
        }
        for (const lId of currentDeleted) {
          if (!remoteDeletedSet.has(lId)) {
            hasNewLocalDeletesToPush = true;
          }
        }
        if (currentDeleted.size > 0) {
          saveDeletedIds(currentDeleted);
        }
        if (role === 'admin' && hasNewLocalDeletesToPush && currentDeleted.size > 0) {
          syncDeletedIdsToSupabase(currentDeleted).catch(() => {});
        }

        // Merge any products rescued via cross-device bridge
        if (remoteRescuedList.length > 0) {
          for (const rp of remoteRescuedList) {
            if (rp && rp.id && !currentDeleted.has(rp.id) && !RETIRED_PRODUCT_IDS.has(rp.id)) {
              customAdminProductsMemory.set(rp.id, rp);
              cacheProductMediaInMemory(rp, {
                coverChecked: Boolean(rp.image),
                tagsChecked: true,
              });
            }
          }
          saveCustomProductsToIdb([...customAdminProductsMemory.values()]);
        }

        if (data) {
          const remoteIds = new Set(data.map((r) => r.id));
          const deleted = getDeletedIds();
          const localCustoms = loadCustomAdminProductsSync();

          if (role === 'admin') {
            // Upload missing custom products sequentially so multi-MB Base64 payloads never collide or drop
            void (async () => {
              for (const lp of localCustoms) {
                if (
                  lp &&
                  lp.id &&
                  !remoteIds.has(lp.id) &&
                  !deleted.has(lp.id) &&
                  !RETIRED_PRODUCT_IDS.has(lp.id)
                ) {
                  await upsertProductToSupabase(toDbProduct(lp)).catch(() => false);
                }
              }
            })();
          } else {
            // If a customer device (e.g. phone with IndexedDB cache) has custom user_ products missing from the new DB, push them to the rescue bridge
            const rescuedIds = new Set(remoteRescuedList.map((r) => r.id));
            void (async () => {
              for (const lp of localCustoms) {
                if (
                  lp &&
                  typeof lp.id === 'string' &&
                  lp.id.startsWith('user_') &&
                  lp.id !== 'user_bunny_keychain_01' &&
                  !remoteIds.has(lp.id) &&
                  !rescuedIds.has(lp.id) &&
                  !deleted.has(lp.id) &&
                  !RETIRED_PRODUCT_IDS.has(lp.id) &&
                  typeof lp.image === 'string' &&
                  lp.image.length > 100
                ) {
                  await pushRescuedProductToSupabase(lp);
                }
              }
            })();
          }

          const merged = mergeWithMockProducts([...remoteRescuedList, ...data]);
          setProducts((prev) => {
            if (productsSignature(merged) === productsSignature(prev)) {
              return prev;
            }
            saveCachedProducts(merged);
            return merged;
          });
        } else if (remoteDeletedList.length > 0) {
          setProducts((prev) =>
            prev.filter((p) => !currentDeleted.has(p.id))
          );
        }
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    };

    let lastSyncTs = Date.now();
    syncProducts();
    // Egress-safe 5-minute background sync; IndexedDB + hydratedMediaMemory prevent re-downloading cached product images
    const timer = setInterval(() => {
      lastSyncTs = Date.now();
      syncProducts();
    }, 300000);
    const handleFocus = () => {
      if (Date.now() - lastSyncTs < 120000) return;
      lastSyncTs = Date.now();
      syncProducts();
    };
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleFocus();
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
    if (deletedIdsMemory.has(product.id)) {
      deletedIdsMemory.delete(product.id);
      saveDeletedIds(deletedIdsMemory);
      syncDeletedIdsToSupabase(deletedIdsMemory).catch(() => {});
    }
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
    // Also mark any legacy mapped ID as deleted so original seed products never resurrect via legacy alias
    for (const [legacyId, mockId] of Object.entries(LEGACY_ID_TO_MOCK_ID)) {
      if (mockId === id || legacyId === id) {
        deleted.add(legacyId);
        deleted.add(mockId);
      }
    }
    saveDeletedIds(deleted);
    syncDeletedIdsToSupabase(deleted).catch(() => {});
    setProducts((prev) => {
      const next = prev.filter((p) => !deleted.has(p.id));
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
      userId: sanitizeText(review.userId || 'customer', 80),
      userName: validated.data.userName,
      rating: validated.data.rating,
      comment: validated.data.comment,
      date: sanitizeText(review.date || new Date().toISOString(), 40),
    };
    setShopReviews((prev) => {
      const next = [sanitized, ...filterRealShopReviews(prev)].slice(0, 60);
      saveCachedShopReviews(next);
      syncShopReviewsToSupabase(next).catch(() => {});
      return next;
    });
  }, []);

  const removeShopReview = useCallback(
    (reviewId: string) => {
      if (role !== 'admin') return;
      setShopReviews((prev) => {
        const next = filterRealShopReviews(prev).filter((r) => r.id !== reviewId);
        saveCachedShopReviews(next);
        syncShopReviewsToSupabase(next).catch(() => {});
        return next;
      });
    },
    [role]
  );

  const replyToShopReview = useCallback(
    (reviewId: string, replyText: string) => {
      if (role !== 'admin') return;
      const cleanReply = sanitizeMultilineText(replyText || '', 600);
      setShopReviews((prev) => {
        const next = filterRealShopReviews(prev).map((r) => {
          if (r.id !== reviewId) return r;
          return {
            ...r,
            adminReply: cleanReply || undefined,
            adminReplyDate: cleanReply ? new Date().toISOString() : undefined,
          };
        });
        saveCachedShopReviews(next);
        syncShopReviewsToSupabase(next).catch(() => {});
        return next;
      });
    },
    [role]
  );

  const importProductsFromRawData = useCallback(
    async (rawText: string): Promise<number> => {
      if (role !== 'admin') return 0;
      const imported = parseImportedProductsRaw(rawText);
      if (imported.length === 0) return 0;
      const deleted = getDeletedIds();
      let count = 0;
      for (const item of imported) {
        if (!item || !item.id || deleted.has(item.id) || RETIRED_PRODUCT_IDS.has(item.id)) {
          continue;
        }
        persistCustomAdminProduct(item);
        cacheProductMediaInMemory(item, {
          coverChecked: Boolean(item.image),
          tagsChecked: true,
        });
        count++;
      }
      if (count > 0) {
        setProducts((prev) => {
          const merged = mergeWithMockProducts([...imported, ...prev]);
          saveCachedProducts(merged);
          return merged;
        });
        for (const item of imported) {
          if (!item || !item.id || deleted.has(item.id) || RETIRED_PRODUCT_IDS.has(item.id)) {
            continue;
          }
          await upsertProductToSupabase(toDbProduct(item)).catch(() => false);
        }
      }
      return count;
    },
    [role]
  );

  const addShopCategory = useCallback(
    (input: {
      label: string;
      emoji?: string;
      craftLine: 'len' | 'kem_nhung';
    }): ShopCategoryItem | null => {
      if (role !== 'admin') return null;
      const cleanLabel = sanitizeText(input.label, 40);
      if (!cleanLabel) return null;
      const cleanEmoji = sanitizeText(input.emoji || '🧶', 8) || '🧶';
      const craftLine = input.craftLine === 'kem_nhung' ? 'kem_nhung' : 'len';

      // Reuse built-in ID if label matches a default category (in case Admin re-adds a previously removed default category)
      const matchedDefault = DEFAULT_SHOP_CATEGORIES.find(
        (d) => d.label.toLowerCase() === cleanLabel.toLowerCase()
      );
      const id = matchedDefault ? matchedDefault.id : `cat_${Date.now()}`;
      const newItem: ShopCategoryItem = {
        id,
        label: cleanLabel,
        emoji: cleanEmoji,
        craftLine,
      };
      setDynamicCategoriesRegistry([newItem]);
      setShopCategories((prev) => {
        const exists = prev.find(
          (c) => c.id === id || c.label.toLowerCase() === cleanLabel.toLowerCase()
        );
        const next = exists
          ? prev.map((c) => (c.id === exists.id ? { ...c, emoji: cleanEmoji, craftLine } : c))
          : [...prev, newItem];
        saveCachedShopCategories(next);
        syncShopCategoriesToSupabase(next).catch(() => {});
        return next;
      });
      return newItem;
    },
    [role]
  );

  const removeShopCategory = useCallback(
    (categoryId: string) => {
      if (role !== 'admin') return;
      setShopCategories((prev) => {
        const next = prev.filter((c) => c.id !== categoryId);
        if (next.length === 0) return prev;
        saveCachedShopCategories(next);
        syncShopCategoriesToSupabase(next).catch(() => {});
        return next;
      });
    },
    [role]
  );

  const resetShopCategories = useCallback(() => {
    if (role !== 'admin') return;
    const defaults = [...DEFAULT_SHOP_CATEGORIES];
    setDynamicCategoriesRegistry(defaults);
    setShopCategories(defaults);
    saveCachedShopCategories(defaults);
    syncShopCategoriesToSupabase(defaults).catch(() => {});
  }, [role]);

  const contextValue = useMemo(
    () => ({
      products,
      shopReviews,
      shopCategories,
      isLoading: !loaded,
      hasMore,
      loadMore,
      addProduct,
      updateProduct,
      removeProduct,
      addReview,
      addShopReview,
      removeShopReview,
      replyToShopReview,
      addShopCategory,
      removeShopCategory,
      resetShopCategories,
      refetchProducts,
      importProductsFromRawData,
    }),
    [
      products,
      shopReviews,
      shopCategories,
      loaded,
      hasMore,
      loadMore,
      addProduct,
      updateProduct,
      removeProduct,
      addReview,
      addShopReview,
      removeShopReview,
      replyToShopReview,
      addShopCategory,
      removeShopCategory,
      resetShopCategories,
      refetchProducts,
      importProductsFromRawData,
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
