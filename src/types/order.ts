import { Product } from './product';
import { Address } from './address';

export type OrderStatus =
  | 'pending_payment'
  | 'awaiting_confirmation'
  | 'placed'
  | 'Đang xử lý'
  | 'Đang chuẩn bị hàng'
  | 'Đang giao'
  | 'Hoàn thành';

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
