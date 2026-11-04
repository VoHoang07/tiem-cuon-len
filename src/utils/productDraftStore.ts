import { Platform } from 'react-native';
import { Category, ProductColorOption } from '@/types/product';

export interface AdminProductDraft {
  id: string;
  updatedAt: string;
  name: string;
  price: string;
  category: Category;
  material: string;
  isMadeToOrder: boolean;
  quantity: string;
  description: string;
  tags: string;
  coverImage: string | null;
  colorOptions: ProductColorOption[];
  extraPhotos: string[];
}

const IDB_NAME = 'tcl_products_idb_v1';
const IDB_STORE = 'kv';
const DRAFTS_LIST_KEY = 'admin_product_drafts_v1';
const WORKING_DRAFT_KEY = 'admin_working_draft_v1';

async function idbGet<T>(key: string): Promise<T | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return null;
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get(key);
          getReq.onsuccess = () => resolve((getReq.result as T) ?? null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(key: string, val: T): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return;
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(val, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return;
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Checks whether a draft has any meaningful admin work worth saving
 * (e.g. a product name, price, cover photo, variant photo, extra photo, or custom description).
 */
export function isDraftMeaningful(draft: Partial<AdminProductDraft>): boolean {
  if (!draft) return false;
  if (draft.name && draft.name.trim().length > 0) return true;
  if (draft.price && draft.price.replace(/[^0-9]/g, '').length > 0) return true;
  if (draft.coverImage) return true;
  if (draft.extraPhotos && draft.extraPhotos.length > 0) return true;
  if (draft.description && draft.description.trim().length > 0) return true;
  if (draft.colorOptions && draft.colorOptions.some((c) => Boolean(c.image))) return true;
  if (draft.colorOptions && draft.colorOptions.length > 2) return true;
  return false;
}

export async function loadAdminDrafts(): Promise<AdminProductDraft[]> {
  const fromIdb = await idbGet<AdminProductDraft[]>(DRAFTS_LIST_KEY);
  if (Array.isArray(fromIdb)) {
    return fromIdb.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(DRAFTS_LIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function saveAdminDraft(draft: AdminProductDraft): Promise<AdminProductDraft[]> {
  const current = await loadAdminDrafts();
  const updatedDraft: AdminProductDraft = {
    ...draft,
    id: draft.id || `draft_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };
  const next = [
    updatedDraft,
    ...current.filter((d) => d.id !== updatedDraft.id),
  ].slice(0, 30);

  await idbSet(DRAFTS_LIST_KEY, next);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage quota exceeded when draft contains many HD photos (IndexedDB already saved it)
    }
  }
  return next;
}

export async function deleteAdminDraft(draftId: string): Promise<AdminProductDraft[]> {
  const current = await loadAdminDrafts();
  const next = current.filter((d) => d.id !== draftId);
  await idbSet(DRAFTS_LIST_KEY, next);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  const working = await loadWorkingDraft();
  if (working && working.id === draftId) {
    await clearWorkingDraft();
  }
  return next;
}

export async function loadWorkingDraft(): Promise<AdminProductDraft | null> {
  const fromIdb = await idbGet<AdminProductDraft>(WORKING_DRAFT_KEY);
  if (fromIdb && isDraftMeaningful(fromIdb)) {
    return fromIdb;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(WORKING_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminProductDraft;
        if (parsed && isDraftMeaningful(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function saveWorkingDraft(draft: AdminProductDraft): Promise<void> {
  if (!isDraftMeaningful(draft)) return;
  const payload: AdminProductDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  await idbSet(WORKING_DRAFT_KEY, payload);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(WORKING_DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // IndexedDB handles large photo sets
    }
  }
}

export async function clearWorkingDraft(): Promise<void> {
  await idbDelete(WORKING_DRAFT_KEY);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(WORKING_DRAFT_KEY);
    } catch {
      // ignore
    }
  }
}
