import { formatVND } from './formatCurrency';
import type { Order } from '@/types/order';

const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID || 'service_fk9anb7';
const EMAILJS_TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_q41v0ct';
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY || 'kT2DQJicRXPdQjvb3';

interface OrderNotificationData {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  paymentMethod: string;
  createdAt: string;
}

const sentOrderIdsMemory = new Set<string>();

function hasAlreadySentEmail(orderId: string): boolean {
  if (sentOrderIdsMemory.has(orderId)) return true;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(`__tcl_email_sent_${orderId}`) === '1';
    }
  } catch {
    // ignore
  }
  return false;
}

function markEmailSent(orderId: string): void {
  sentOrderIdsMemory.add(orderId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`__tcl_email_sent_${orderId}`, '1');
    }
  } catch {
    // ignore
  }
}

/**
 * Send an order notification email to the shop owner via EmailJS.
 * Silently fails if EmailJS is not configured or if already sent for this orderId.
 */
export async function sendOrderNotification(data: OrderNotificationData): Promise<void> {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn('[EMAIL] EmailJS chưa cấu hình — bỏ qua gửi email thông báo');
    return;
  }

  if (hasAlreadySentEmail(data.orderId)) {
    return;
  }
  markEmailSent(data.orderId);

  const itemsList = data.items
    .map((item, i) => `${i + 1}. ${item.name} x${item.quantity} — ${formatVND(item.price * item.quantity)}`)
    .join('\n');

  const orderDate = new Date(data.createdAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const templateParams = {
    order_id: data.orderId,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_address: data.customerAddress,
    items_list: itemsList,
    total: formatVND(data.total),
    payment_method: data.paymentMethod,
    order_date: orderDate,
    // EmailJS template variable for subject
    subject: `🧶 Đơn hàng mới #${data.orderId} — ${data.customerName}`,
    email: 'khanhly30072007@gmail.com',
  };

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });

    if (!res.ok) {
      console.error('[EMAIL] Gửi email thất bại:', res.status, await res.text());
    }
  } catch (e) {
    console.error('[EMAIL] Lỗi gửi email thông báo:', e);
  }
}

export async function sendOrderNotificationForOrder(order: Order): Promise<void> {
  if (!order || !order.id) return;
  const addr = order.shippingAddress;
  const shippingMethod = addr?.shippingMethod || 'Giao Tiết Kiệm';
  const shippingFee = typeof addr?.shippingFee === 'number' ? addr.shippingFee : 0;

  await sendOrderNotification({
    orderId: order.id,
    customerName: addr?.fullName || 'Khách hàng',
    customerPhone: addr?.phone || '',
    customerAddress: [
      addr?.detailAddress,
      addr?.ward,
      addr?.district,
      addr?.city,
    ]
      .filter(Boolean)
      .join(', '),
    items: [
      ...(order.items || []).map((ci) => ({
        name: ci.product?.name || 'Sản phẩm',
        quantity: ci.quantity,
        price: ci.price ?? ci.product?.price ?? 0,
      })),
      {
        name: `🚚 Vận chuyển: ${shippingMethod}`,
        quantity: 1,
        price: shippingFee,
      },
    ],
    total: order.total,
    paymentMethod: `${order.paymentMethod} • ${shippingMethod}`,
    createdAt: order.createdAt || new Date().toISOString(),
  });
}
