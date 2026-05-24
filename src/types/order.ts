import { Product } from './product';
import { Address } from './address';

export type OrderStatus = 'Đang xử lý' | 'Đang giao' | 'Hoàn thành';

export interface OrderItem {
  product: Product;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  shippingAddress: Address;
  paymentMethod: string;
  status: OrderStatus;
  createdAt: string;
}
