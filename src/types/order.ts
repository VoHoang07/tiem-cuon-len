import { Address } from './address';
import { Product } from './product';

export type OrderStatus =
  | 'pending_payment'
  | 'awaiting_confirmation'
  | 'placed'
  | 'Đang xử lý'
  | 'Đang chuẩn bị hàng'
  | 'Đang giao'
  | 'Hoàn thành'
  | 'Đã hủy';

export interface OrderItem {
  product: Product;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId?: string;
  items: OrderItem[];
  total: number;
  shippingAddress: Address;
  paymentMethod: string;
  status: OrderStatus;
  createdAt: string;
  isMaskedGuestView?: boolean;
}
