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
import {
  sanitizeText,
  validateOrderShippingUpdateSchema,
} from '@/utils/schemaValidator';

async function callOrdersGuardApi(body: Record<string, unknown>): Promise<{
  ok: boolean;
  order?: Order;
}> {
  if (typeof window === 'undefined') return { ok: false };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false };

    const res = await fetch('/api/orders-guard', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    if (data && data.success) {
      return { ok: true, order: data.order as Order | undefined };
    }
  } catch {
    // fallback to direct Supabase call
  }
  return { ok: false };
}

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
      const ORDER_COLUMNS =
        'id,userId,items,total,status,paymentMethod,shippingAddress,createdAt';
      const query = supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .order('createdAt', { ascending: false })
        .limit(100);

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

    // 1. Primary: Server-side Order Guard API (recalculates authoritative prices & enforces Anti-IDOR)
    const guardResult = await callOrdersGuardApi({ action: 'create', order });
    if (guardResult.ok && guardResult.order) {
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === order.id ? guardResult.order! : o));
        saveCachedOrders(next, user?.id);
        return next;
      });
      return;
    }

    // 2. Fallback: Direct Supabase upsert (when running local Expo dev server without /api)
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
    const validated = validateOrderShippingUpdateSchema({ orderId, status });
    if (!validated.success || !validated.data) return;

    setOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, status } : o));
      saveCachedOrders(next, user?.id);
      return next;
    });
    if (role !== 'admin') return;

    const guardResult = await callOrdersGuardApi({
      action: 'update_status',
      orderId: validated.data.orderId,
      status: validated.data.status,
    });
    if (guardResult.ok) return;

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
      const validated = validateOrderShippingUpdateSchema({
        orderId,
        status: payload.status,
        shippingCarrier: payload.shippingCarrier,
        trackingCode: payload.trackingCode,
      });
      if (!validated.success || !validated.data) return;

      let updatedAddress: Order['shippingAddress'] | null = null;
      let updatedStatus: OrderStatus | undefined = payload.status;

      setOrders((prev) => {
        const next = prev.map((o) => {
          if (o.id !== orderId) return o;
          const nextAddr: Order['shippingAddress'] = {
            ...o.shippingAddress,
            shippingCarrier:
              validated.data?.shippingCarrier !== undefined
                ? validated.data.shippingCarrier
                : o.shippingAddress?.shippingCarrier,
            trackingCode:
              validated.data?.trackingCode !== undefined
                ? validated.data.trackingCode
                : o.shippingAddress?.trackingCode,
            shippedAt:
              validated.data?.trackingCode || payload.status === 'Đang giao'
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

      const guardResult = await callOrdersGuardApi({
        action: 'update_shipping',
        orderId: validated.data.orderId,
        status: updatedStatus,
        shippingCarrier: validated.data.shippingCarrier,
        trackingCode: validated.data.trackingCode,
      });
      if (guardResult.ok) return;

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
    const cleanId = sanitizeText(orderId, 80);
    if (!cleanId) return;

    // Anti-IDOR check in client store before deleting
    const target = orders.find((o) => o.id === cleanId);
    if (target && role !== 'admin' && target.userId !== user.id) {
      return;
    }

    deletedOrderIdsRef.current.add(cleanId);
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== cleanId);
      saveCachedOrders(next, user?.id);
      return next;
    });

    const guardResult = await callOrdersGuardApi({
      action: 'delete',
      orderId: cleanId,
    });
    if (guardResult.ok) return;

    try {
      const query = supabase.from('orders').delete().eq('id', cleanId);
      if (role !== 'admin') {
        await query.eq('userId', user.id);
      } else {
        await query;
      }
    } catch {
      // keep local deletion
    }
  }, [user?.id, role, orders]);

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
