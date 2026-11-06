import type { Order } from '@/types/order';
import { formatVND } from '@/utils/formatCurrency';

export interface CarrierInfo {
  id: string;
  name: string;
  shortLabel: string;
  portalUrl: string;
  buildTrackingUrl: (code: string) => string;
}

export const SHIPPING_CARRIERS: CarrierInfo[] = [
  {
    id: 'viettel_post',
    name: 'Viettel Post',
    shortLabel: 'Viettel Post',
    portalUrl: 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/',
    buildTrackingUrl: () => 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/',
  },
  {
    id: 'ghtk',
    name: 'Giao Hàng Tiết Kiệm (GHTK)',
    shortLabel: 'GHTK',
    portalUrl: 'https://i.ghtk.vn/',
    buildTrackingUrl: (code) => `https://i.ghtk.vn/${encodeURIComponent(code.trim())}`,
  },
  {
    id: 'ghn',
    name: 'Giao Hàng Nhanh (GHN)',
    shortLabel: 'GHN',
    portalUrl: 'https://donhang.ghn.vn/',
    buildTrackingUrl: (code) =>
      `https://donhang.ghn.vn/?order_code=${encodeURIComponent(code.trim())}`,
  },
  {
    id: 'jt',
    name: 'J&T Express',
    shortLabel: 'J&T Express',
    portalUrl: 'https://jtexpress.vn/vi/tracking',
    buildTrackingUrl: (code) =>
      `https://jtexpress.vn/vi/tracking?type=track&billcode=${encodeURIComponent(
        code.trim()
      )}`,
  },
  {
    id: 'spx',
    name: 'SPX Express',
    shortLabel: 'SPX',
    portalUrl: 'https://spx.vn/',
    buildTrackingUrl: (code) =>
      `https://spx.vn/m/tracking-detail/${encodeURIComponent(code.trim())}`,
  },
  {
    id: 'grab_ahamove',
    name: 'GrabExpress / Ahamove (Hỏa tốc)',
    shortLabel: 'Grab / Ahamove',
    portalUrl: 'https://www.ahamove.com/',
    buildTrackingUrl: (code) =>
      code.trim().startsWith('http') ? code.trim() : 'https://www.ahamove.com/',
  },
  {
    id: 'pickup',
    name: 'Nhận trực tiếp tại Tiệm',
    shortLabel: 'Nhận tại tiệm',
    portalUrl: 'https://www.tiemcuonlen.shop/',
    buildTrackingUrl: () => 'https://www.tiemcuonlen.shop/',
  },
];

export const ADMIN_BOOKING_PORTALS = [
  { name: 'Goship (So sánh giá rẻ)', url: 'https://goship.io' },
  { name: 'Viettel Post', url: 'https://viettelpost.com.vn' },
  { name: 'GHTK', url: 'https://khachhang.giaohangtietkiem.vn' },
  { name: 'GHN', url: 'https://khachhang.ghn.vn' },
];

export function isCodOrder(order: Order): boolean {
  const pm = (order.paymentMethod || '').toLowerCase();
  return pm.includes('nhận hàng') || pm.includes('cod');
}

export function getCodCollectAmount(order: Order): number {
  return isCodOrder(order) ? order.total : 0;
}

export function getFullAddressString(order: Order): string {
  const addr = order.shippingAddress;
  if (!addr) return 'Chưa có địa chỉ';
  return [addr.detailAddress, addr.ward, addr.district, addr.city]
    .filter(Boolean)
    .join(', ');
}

export function getCarrierTrackingUrl(
  carrierLabel?: string,
  trackingCode?: string
): string | null {
  const cleanCode = (trackingCode || '').trim();
  if (!cleanCode && !carrierLabel) return null;
  if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
    return cleanCode;
  }
  const norm = (carrierLabel || '').toLowerCase();
  const matched = SHIPPING_CARRIERS.find(
    (c) =>
      c.shortLabel.toLowerCase() === norm ||
      c.name.toLowerCase() === norm ||
      c.id === norm
  );
  if (matched) {
    return matched.buildTrackingUrl(cleanCode);
  }
  return cleanCode
    ? `https://www.google.com/search?q=${encodeURIComponent(
        `${carrierLabel || 'tra cứu vận đơn'} ${cleanCode}`
      )}`
    : null;
}

export function formatShippingSlipForClipboard(order: Order): string {
  const addr = order.shippingAddress;
  const fullAddress = getFullAddressString(order);
  const codAmount = getCodCollectAmount(order);
  const itemsValue = order.items.reduce(
    (sum, i) => sum + (i.price ?? i.product.price) * i.quantity,
    0
  );
  const itemsText = order.items
    .map((i) => {
      const card = i.product.giftCardNote
        ? ` [💌 Thiệp: "${i.product.giftCardNote}"]`
        : '';
      return `${i.product.name} (x${i.quantity})${card}`;
    })
    .join(', ');
  const shipMethod = addr?.shippingMethod || 'Giao tiêu chuẩn';
  const isExpress = shipMethod.toLowerCase().includes('hỏa tốc');

  return [
    `📦 ĐƠN HÀNG TIỆM CUỘN LEN (#${order.id.slice(-8)})`,
    `👤 Người nhận: ${addr?.fullName || 'Khách hàng'}`,
    `📞 SĐT: ${addr?.phone || '—'}`,
    `📍 Địa chỉ: ${fullAddress}`,
    addr?.note ? `📝 Ghi chú / Thiệp: ${addr.note}` : '',
    `🚚 Hình thức giao: ${shipMethod}`,
    isExpress
      ? '⚡ Cước ship Hỏa Tốc: Khách tự trả cước trực tiếp cho tài xế theo giá App'
      : '💳 Mục "Người trả phí" trên Goship: Chọn "Shop trả"',
    `💰 Ô "Thu hộ" (COD): ${
      codAmount > 0
        ? `${formatVND(codAmount)} (Đơn COD - Shipper thu của khách)`
        : '0₫ (Khách ĐÃ CHUYỂN KHOẢN QR - Điền số 0)'
    }`,
    `🛡️ Ô "Khai giá" (Giá trị hàng): ${formatVND(itemsValue || order.total)}`,
    `⚖️ Cân nặng gợi ý: 250g • Loại hàng: Đồ chơi / Quà tặng`,
    `🧶 Sản phẩm (${order.items.reduce((s, i) => s + i.quantity, 0)} món): ${itemsText}`,
  ]
    .filter(Boolean)
    .join('\n');
}
