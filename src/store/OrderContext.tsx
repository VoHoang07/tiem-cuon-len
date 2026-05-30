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

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  deleteOrder: (orderId: string) => Promise<void>;
  getOrdersByUser: (userId: string) => Order[];
  refetchOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  const fetchOrders = useCallback(async () => {
    const query = supabase.from('orders').select('*').order('createdAt', { ascending: false });

    if (role === 'admin') {
      const { data, error } = await query;
      if (!error && data) setOrders(data as Order[]);
    } else if (user) {
      const { data, error } = await query.eq('userId', user.id);
      if (!error && data) setOrders(data as Order[]);
    } else {
      setOrders([]);
    }
  }, [user, role]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const refetchOrders = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);
    supabase.from('orders').insert(order).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi tạo đơn:', error.message);
    }, () => {});
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    supabase.from('orders').update({ status }).eq('id', orderId).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi cập nhật đơn:', error.message);
    }, () => {});
  }, []);

  const getOrdersByUser = useCallback(
    (userId: string) => orders.filter((o) => o.userId === userId),
    [orders]
  );

  const deleteOrder = useCallback(async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    const { error } = await supabase.from('orders').delete().eq('id', orderId);

    if (error) {
      if (__DEV__) console.error('[DELETE ERROR]', error);
      await fetchOrders();
      throw error;
    }
  }, [fetchOrders]);

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
