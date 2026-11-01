import { formatVND } from './formatCurrency';

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

/**
 * Send an order notification email to the shop owner via EmailJS.
 * Silently fails if EmailJS is not configured.
 */
export async function sendOrderNotification(data: OrderNotificationData): Promise<void> {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn('[EMAIL] EmailJS chưa cấu hình — bỏ qua gửi email thông báo');
    return;
  }

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
