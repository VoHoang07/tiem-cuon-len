import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Order, OrderStatus } from '@/types/order';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

const ORDERS_CACHE_KEY = 'tcl_orders_cache_v1';

function loadCachedOrders(): Order[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ORDERS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Order[];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCachedOrders(items: Order[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore
  }
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  deleteOrder: (orderId: string) => Promise<void>;
  getOrdersByUser: (userId: string) => Order[];
  refetchOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => loadCachedOrders());

  const fetchOrders = useCallback(async () => {
    try {
      const query = supabase.from('orders').select('*').order('createdAt', { ascending: false });

      if (role === 'admin') {
        const { data, error } = await query;
        if (!error && data) {
          setOrders(data as Order[]);
          saveCachedOrders(data as Order[]);
        }
      } else if (user) {
        const { data, error } = await query.eq('userId', user.id);
        if (!error && data) {
          // Merge remote orders with local-only orders (not yet synced)
          setOrders((prev) => {
            const remoteIds = new Set((data as Order[]).map((o) => o.id));
            const localOnly = prev.filter((o) => o.userId === user.id && !remoteIds.has(o.id));
            const merged = [...(data as Order[]), ...localOnly].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            saveCachedOrders(merged);
            return merged;
          });
        }
      }
    } catch {
      // keep cached orders
    }
  }, [user, role]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const refetchOrders = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  const addOrder = useCallback(async (order: Order) => {
    setOrders((prev) => {
      const next = [order, ...prev];
      saveCachedOrders(next);
      return next;
    });
    try {
      const { error } = await supabase.from('orders').insert(order);
      if (error) {
        console.error('[SUPABASE] Lỗi tạo đơn:', error.message);
        // Retry once after 2s
        setTimeout(async () => {
          const { error: retryErr } = await supabase.from('orders').insert(order);
          if (retryErr) console.error('[SUPABASE] Retry lỗi:', retryErr.message);
        }, 2000);
      }
    } catch (e) {
      console.error('[SUPABASE] Network error:', e);
    }
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      saveCachedOrders(next);
      return next;
    });
    supabase.from('orders').update({ status }).eq('id', orderId).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi cập nhật đơn:', error.message);
    }, () => {});
  }, []);

  const getOrdersByUser = useCallback(
    (userId: string) => orders.filter((o) => o.userId === userId),
    [orders]
  );

  const deleteOrder = useCallback(async (orderId: string) => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== orderId);
      saveCachedOrders(next);
      return next;
    });

    try {
      await supabase.from('orders').delete().eq('id', orderId);
    } catch {
      // keep local deletion
    }
  }, []);

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus, deleteOrder, getOrdersByUser, refetchOrders }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) {
    throw new Error('useOrders must be used within OrderProvider');
  }
  return ctx;
}
