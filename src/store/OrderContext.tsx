import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Order, OrderStatus } from '@/types/order';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

const ORDERS_CACHE_KEY_PREFIX = 'tcl_orders_cache_v2';

function getOrdersCacheKey(userId?: string): string {
  return `${ORDERS_CACHE_KEY_PREFIX}_${userId || 'guest'}`;
}

function loadCachedOrders(userId?: string): Order[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(getOrdersCacheKey(userId));
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

function ordersSignature(items: Order[]): string {
  return items
    .map(
      (o) =>
        `${o.id}:${o.status}:${o.total}:${o.items?.length || 0}:${o.shippingAddress?.shippingCarrier || ''}:${o.shippingAddress?.trackingCode || ''}`
    )
    .join('|');
}

function saveCachedOrders(items: Order[], userId?: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  setTimeout(() => {
    try {
      window.localStorage.setItem(getOrdersCacheKey(userId), JSON.stringify(items));
    } catch {
      // ignore
    }
  }, 0);
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateOrderShipping: (
    orderId: string,
    payload: {
      status?: OrderStatus;
      shippingCarrier?: string;
      trackingCode?: string;
    }
  ) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  getOrdersByUser: (userId: string) => Order[];
  refetchOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => loadCachedOrders(user?.id));
  const deletedOrderIdsRef = useRef<Set<string>>(new Set());

  // Reset orders when user changes
  useEffect(() => {
    setOrders(loadCachedOrders(user?.id));
  }, [user?.id]);

  const fetchOrders = useCallback(async () => {
    if (!user && role !== 'admin') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const query = supabase.from('orders').select('*').order('createdAt', { ascending: false });

      if (role === 'admin') {
        const { data, error } = await query;
        if (!error && data) {
          const filtered = (data as Order[]).filter((o) => !deletedOrderIdsRef.current.has(o.id));
          setOrders((prev) => {
            if (ordersSignature(filtered) === ordersSignature(prev)) return prev;
            saveCachedOrders(filtered, user?.id);
            return filtered;
          });
        }
      } else if (user) {
        const { data, error } = await query.eq('userId', user.id);
        if (!error && data) {
          // Merge remote orders with only brand-new in-flight local orders (< 10s old)
          // so orders deleted by Admin on the server are also removed on the client
          setOrders((prev) => {
            const remoteRows = (data as Order[]).filter((o) => !deletedOrderIdsRef.current.has(o.id));
            const remoteIds = new Set(remoteRows.map((o) => o.id));
            const now = Date.now();
            const localInFlight = prev.filter(
              (o) =>
                o.userId === user.id &&
                !deletedOrderIdsRef.current.has(o.id) &&
                !remoteIds.has(o.id) &&
                now - new Date(o.createdAt).getTime() < 10000
            );
            const merged = [...remoteRows, ...localInFlight].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (ordersSignature(merged) === ordersSignature(prev)) return prev;
            saveCachedOrders(merged, user.id);
            return merged;
          });
        }
      }
    } catch {
      // keep cached orders
    }
  }, [user, role]);

  useEffect(() => {
    if (!user && role !== 'admin') return;
    fetchOrders();
    const timer = setInterval(fetchOrders, 8000);
    const handleFocus = () => {
      fetchOrders();
    };
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    const handlePageShow = () => {
      fetchOrders();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('pageshow', handlePageShow);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('pageshow', handlePageShow);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [user, role, fetchOrders]);

  const refetchOrders = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  const addOrder = useCallback(async (order: Order) => {
    setOrders((prev) => {
      const next = [order, ...prev];
      saveCachedOrders(next, user?.id);
      return next;
    });
    try {
      const { error } = await supabase.from('orders').upsert(order, { onConflict: 'id' });
      if (error && supabaseUrl && supabaseAnonKey) {
        await fetch(`${supabaseUrl}/rest/v1/orders?on_conflict=id`, {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(order),
        });
      }
    } catch {
      if (supabaseUrl && supabaseAnonKey) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/orders?on_conflict=id`, {
            method: 'POST',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify(order),
          });
        } catch {
          // ignore
        }
      }
    }
  }, [user?.id]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      saveCachedOrders(next, user?.id);
      return next;
    });
    if (role !== 'admin') return;
    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error && supabaseUrl && supabaseAnonKey) {
        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ status }),
        });
      }
    } catch {
      // keep local update
    }
  }, [user?.id, role]);

  const updateOrderShipping = useCallback(
    async (
      orderId: string,
      payload: {
        status?: OrderStatus;
        shippingCarrier?: string;
        trackingCode?: string;
      }
    ) => {
      if (role !== 'admin') return;
      let updatedAddress: Order['shippingAddress'] | null = null;
      let updatedStatus: OrderStatus | undefined = payload.status;

      setOrders((prev) => {
        const next = prev.map((o) => {
          if (o.id !== orderId) return o;
          const nextAddr: Order['shippingAddress'] = {
            ...o.shippingAddress,
            shippingCarrier:
              payload.shippingCarrier !== undefined
                ? payload.shippingCarrier.trim()
                : o.shippingAddress?.shippingCarrier,
            trackingCode:
              payload.trackingCode !== undefined
                ? payload.trackingCode.trim()
                : o.shippingAddress?.trackingCode,
            shippedAt:
              payload.trackingCode || payload.status === 'Đang giao'
                ? o.shippingAddress?.shippedAt || new Date().toISOString()
                : o.shippingAddress?.shippedAt,
          };
          updatedAddress = nextAddr;
          const nextStat = payload.status ?? o.status;
          updatedStatus = nextStat;
          return {
            ...o,
            status: nextStat,
            shippingAddress: nextAddr,
          };
        });
        saveCachedOrders(next, user?.id);
        return next;
      });

      if (!updatedAddress) return;
      try {
        const updateRow: Record<string, unknown> = {
          shippingAddress: updatedAddress,
        };
        if (updatedStatus) {
          updateRow.status = updatedStatus;
        }
        const { error } = await supabase
          .from('orders')
          .update(updateRow)
          .eq('id', orderId);
        if (error) console.error('[SUPABASE] Lỗi cập nhật vận đơn:', error.message);
      } catch {
        // keep optimistic local update
      }
    },
    [user?.id, role]
  );

  const getOrdersByUser = useCallback(
    (userId: string) => orders.filter((o) => o.userId === userId),
    [orders]
  );

  const deleteOrder = useCallback(async (orderId: string) => {
    if (!user?.id) return;
    deletedOrderIdsRef.current.add(orderId);
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== orderId);
      saveCachedOrders(next, user?.id);
      return next;
    });

    try {
      const query = supabase.from('orders').delete().eq('id', orderId);
      if (role !== 'admin') {
        await query.eq('userId', user.id);
      } else {
        await query;
      }
    } catch {
      // keep local deletion
    }
  }, [user?.id, role]);

  const contextValue = useMemo(
    () => ({
      orders,
      addOrder,
      updateOrderStatus,
      updateOrderShipping,
      deleteOrder,
      getOrdersByUser,
      refetchOrders,
    }),
    [
      orders,
      addOrder,
      updateOrderStatus,
      updateOrderShipping,
      deleteOrder,
      getOrdersByUser,
      refetchOrders,
    ]
  );

  return (
    <OrderContext.Provider value={contextValue}>
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
