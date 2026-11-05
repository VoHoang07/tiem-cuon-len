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
  }
>();

function cacheProductMediaInMemory(p: Product) {
  if (!p || !p.id) return;
  const hasImage =
    typeof p.image === 'string' && p.image.length > 0;
  const hasColors =
    Array.isArray(p.colorOptions) && p.colorOptions.length > 0;
  if (hasImage || hasColors) {
    const prev = hydratedMediaMemory.get(p.id);
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
  customAdminProductsMemory.delete(id);
  hydratedMediaMemory.delete(id);
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
        `${p.id}:${p.name}:${p.price}:${p.quantity}:${p.isMadeToOrder !== false ? 1 : 0}:${p.rating}:${p.reviews?.length || 0}:${p.colorOptions?.length || 0}:${p.accessoryOptions?.length || 0}:${p.gallery?.length || 0}:${typeof p.image === 'string' ? p.image.length : 1}`
    )
    .join('|');
}

function saveCachedProducts(items: Product[]) {
  if (typeof window === 'undefined' || items.length === 0) return;
  // Full items (including HD Base64 images) are persisted in IndexedDB (100MB+ quota)
  saveToIdb('cached_all_products', items);
  if (!window.localStorage) return;
  setTimeout(() => {
    try {
      // Only store lightweight metadata in localStorage (<20KB) so localStorage NEVER hits 5MB QuotaExceededError
      // and never blocks saving tcl_deleted_product_ids_v1 or Supabase auth tokens
      const lightweight = items.map((p) => ({
        ...p,
        image:
          typeof p.image === 'string' && p.image.startsWith('data:image/')
            ? undefined
            : p.image,
        colorOptions: Array.isArray(p.colorOptions)
          ? p.colorOptions.map((c) => ({
              ...c,
              image:
                typeof c.image === 'string' && c.image.startsWith('data:image/')
                  ? undefined
                  : c.image,
            }))
          : p.colorOptions,
        gallery: undefined,
      }));
      window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(lightweight));
    } catch {
      // ignore
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
  removeShopReview: (reviewId: string) => void;
  replyToShopReview: (reviewId: string, replyText: string) => void;
  refetchProducts: () => Promise<void>;
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
  const [loaded, setLoaded] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  // Hydrate cached, custom admin products, and deleted IDs from IndexedDB on mount
  useEffect(() => {
    Promise.all([
      loadFromIdb('cached_all_products'),
      loadCustomProductsFromIdb(),
      loadFromIdb('deleted_product_ids') as unknown as Promise<string[]>,
    ]).then(([cachedAll, idbCustom, idbDeleted]) => {
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
      if (cachedAll.length > 0) {
        for (const p of cachedAll) {
          if (p && p.id && !deleted.has(p.id)) {
            cacheProductMediaInMemory(p);
          }
        }
      }
      if (idbCustom.length > 0) {
        for (const p of idbCustom) {
          if (p && p.id && !deleted.has(p.id)) {
            customAdminProductsMemory.set(p.id, p);
            cacheProductMediaInMemory(p);
          }
        }
      }
      setProducts((prev) =>
        mergeWithMockProducts(cachedAll.length > 0 ? cachedAll : prev)
      );
    });
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
      const deleted = getDeletedIds();
      const missingIds = baseRows
        .filter((r) => {
          if (!r || !r.id || deleted.has(r.id) || RETIRED_PRODUCT_IDS.has(r.id)) {
            return false;
          }
          const cached = hydratedMediaMemory.get(r.id);
          return !cached || !cached.image;
        })
        .map((r) => r.id);

      if (missingIds.length === 0) return;

      const CHUNK_SIZE = 2;
      for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
        const chunk = missingIds.slice(i, i + CHUNK_SIZE);
        const inFilter = chunk.map((id) => encodeURIComponent(id)).join(',');
        try {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/products?select=id,image,tags&id=in.(${inFilter})`,
            {
              cache: 'no-store',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
            }
          );
          if (res.ok) {
            const mediaRows = (await res.json()) as Array<{
              id: string;
              image?: Product['image'];
              tags?: string[];
            }>;
            if (Array.isArray(mediaRows) && mediaRows.length > 0) {
              for (const mr of mediaRows) {
                const target = baseRows.find((b) => b.id === mr.id);
                if (target) {
                  target.image = mr.image ?? target.image;
                  target.tags = mr.tags ?? target.tags;
                  hydrateDbProduct(target);
                }
              }
              const merged = mergeWithMockProducts(baseRows);
              setProducts(merged);
              saveCachedProducts(merged);
            }
          }
        } catch {
          // continue next chunk
        }
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
    const syncProducts = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      Promise.all([fetchProducts(0), fetchRemoteDeletedIds()])
        .then(([data, remoteDeletedList]) => {
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
          } else if (remoteDeletedList.length > 0) {
            setProducts((prev) =>
              prev.filter((p) => !currentDeleted.has(p.id))
            );
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
      removeShopReview,
      replyToShopReview,
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
      removeShopReview,
      replyToShopReview,
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
