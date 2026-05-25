import type { OrderStatus } from '@/types/order';

// Vietnamese labels for every order status
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Chờ thanh toán',
  awaiting_confirmation: 'Chờ xác nhận thanh toán',
  placed: 'Đã đặt hàng',
  'Đang xử lý': 'Đang xử lý',
  'Đang chuẩn bị hàng': 'Đang chuẩn bị hàng',
  'Đang giao': 'Đang giao hàng',
  'Hoàn thành': 'Hoàn thành',
};

// Color scheme for status badges
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: '#E8A840',
  awaiting_confirmation: '#E8A840',
  placed: '#6BAF5C',
  'Đang xử lý': '#E8A840',
  'Đang chuẩn bị hàng': '#4A90D9',
  'Đang giao': '#4A90D9',
  'Hoàn thành': '#6BAF5C',
};

// Admin progression: what's the next status after this one?
export const ORDER_STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  pending_payment: 'Đang xử lý',
  awaiting_confirmation: 'Đang xử lý',
  placed: 'Đang xử lý',
  'Đang xử lý': 'Đang chuẩn bị hàng',
  'Đang chuẩn bị hàng': 'Đang giao',
  'Đang giao': 'Hoàn thành',
  'Hoàn thành': null,
};

// Map raw status to display label (safe fallback)
export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

// Map raw status to display color (safe fallback)
export function getOrderStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? '#A08679';
}
