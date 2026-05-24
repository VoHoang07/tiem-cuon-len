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
  getOrdersByUser: (userId: string) => Order[];
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const query = supabase.from('orders').select('*').order('createdAt', { ascending: false });

    // Admin thấy tất cả, customer chỉ thấy đơn của mình
    if (role === 'admin') {
      query.then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[]);
      });
    } else if (user) {
      query.eq('user_id', user.id).then(({ data, error }) => {
        if (!error && data) setOrders(data as Order[]);
      });
    } else {
      setOrders([]);
    }
  }, [user, role]);

  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);
    supabase.from('orders').insert(order).then(({ error }) => {
      if (error) console.error('[SUPABASE] Lỗi tạo đơn:', error.message);
    });
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    supabase.from('orders').update({ status }).eq('id', orderId).then(({ error }) => {
      if (error) console.error('[SUPABASE] Lỗi cập nhật đơn:', error.message);
    });
  }, []);

  const getOrdersByUser = useCallback(
    (userId: string) => orders.filter((o) => o.userId === userId),
    [orders]
  );

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus, getOrdersByUser }}>
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
