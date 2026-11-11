import { supabase } from '@/services/supabase';
import type { Order } from '@/types/order';

interface OrderNotificationData {
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items?: { name: string; quantity: number; price: number }[];
  total?: number;
  paymentMethod?: string;
  createdAt?: string;
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
 * Triggers order notification email via the Server API (`/api/orders-guard` -> `notify_email`).
 * All EmailJS credentials and recipient addresses remain strictly on the Server.
 */
export async function sendOrderNotification(data: OrderNotificationData): Promise<void> {
  if (!data || !data.orderId) return;
  if (hasAlreadySentEmail(data.orderId)) {
    return;
  }
  markEmailSent(data.orderId);

  try {
    if (typeof window === 'undefined') return;
    let accessToken = '';
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData?.session?.access_token || '';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    await fetch('/api/orders-guard', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({
        action: 'notify_email',
        orderId: data.orderId,
      }),
    });
  } catch {
    // Silent fail on network error
  }
}

export async function sendOrderNotificationForOrder(order: Order): Promise<void> {
  if (!order || !order.id) return;
  await sendOrderNotification({ orderId: order.id });
}
