import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';
import { Order } from '@/types/order';
import { Address } from '@/types/address';
import { AppUser } from '@/types/user';

export interface StoredUser {
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

const PRODUCTS_KEY = '@twist_thread_products';
const CART_KEY = '@twist_thread_cart';
const FAVORITES_KEY = '@twist_thread_favorites';
const AUTH_USER_KEY = '@twist_thread_auth_user';
const ORDERS_KEY = '@twist_thread_orders';
const ADDRESSES_KEY = '@twist_thread_addresses';
const USERS_KEY = '@twist_thread_users';

// ─── Products ────────────────────────────────

export async function loadProducts(): Promise<Product[]> {
  try {
    const json = await AsyncStorage.getItem(PRODUCTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveProducts(products: Product[]): Promise<void> {
  try {
    const json = JSON.stringify(products);
    console.log('[STORAGE] Lưu', products.length, 'sản phẩm, kích thước:', (json.length / 1024).toFixed(1), 'KB');
    await AsyncStorage.setItem(PRODUCTS_KEY, json);
  } catch (e) {
    console.error('[STORAGE] Lỗi lưu sản phẩm:', e);
  }
}

// ─── Cart ────────────────────────────────────

export async function loadCart(): Promise<{ productId: string; quantity: number }[]> {
  try {
    const json = await AsyncStorage.getItem(CART_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveCart(
  cart: { productId: string; quantity: number }[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {}
}

// ─── Favorites ───────────────────────────────

export async function loadFavorites(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(FAVORITES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(favorites: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {}
}

// ─── Auth ────────────────────────────────────

export async function loadAuthUser(): Promise<StoredUser | null> {
  try {
    const json = await AsyncStorage.getItem(AUTH_USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveAuthUser(user: StoredUser): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {}
}

export async function removeAuthUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(AUTH_USER_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.includes(AUTH_USER_KEY)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {}
}

// ─── Orders ──────────────────────────────────

export async function loadOrders(): Promise<Order[]> {
  try {
    const json = await AsyncStorage.getItem(ORDERS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveOrders(orders: Order[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {}
}

// ─── Addresses ────────────────────────────────

export async function loadAddresses(): Promise<Address[]> {
  try {
    const json = await AsyncStorage.getItem(ADDRESSES_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveAddresses(addresses: Address[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
  } catch {}
}

// ─── Users (register) ────────────────────────

export async function loadUsers(): Promise<AppUser[]> {
  try {
    const json = await AsyncStorage.getItem(USERS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveUsers(users: AppUser[]): Promise<void> {
  try {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {}
}
