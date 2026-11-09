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
    name: 'GrabExpress / Ahamove (Giao trong ngày TP.HCM)',
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
  const shipLower = shipMethod.toLowerCase();
  const isExpress =
    shipLower.includes('trong ngày') || shipLower.includes('hỏa tốc');

  return [
    `📦 ĐƠN HÀNG TIỆM CUỘN LEN (#${order.id.slice(-8)})`,
    `👤 Người nhận: ${addr?.fullName || 'Khách hàng'}`,
    `📞 SĐT: ${addr?.phone || '—'}`,
    `📍 Địa chỉ: ${fullAddress}`,
    addr?.note ? `📝 Ghi chú / Thiệp: ${addr.note}` : '',
    `🚚 Hình thức giao: ${shipMethod}`,
    isExpress
      ? '⚡ Cước ship Giao trong ngày (TP.HCM): Khách tự trả cước trực tiếp cho tài xế theo giá App'
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

    function escapeCsvCell(val: unknown): string {
    const s = String(val ?? '').replace(/\r?\n/g, ' ');
    if (s.includes(',') || s.includes('"') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
    }

    /**
    * Exports a list of orders into a UTF-8 BOM CSV file formatted specifically for Goship.io / Excel
    * so the Admin can import multiple orders to Goship.io or print packing slips in 1 click.
    */
    export function exportOrdersToGoshipCsv(orders: Order[]): boolean {
    if (!orders || orders.length === 0) return false;
    if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
    }

    const headers = [
    'Mã đơn hàng',
    'Tên người nhận',
    'Số điện thoại',
    'Tỉnh / Thành phố',
    'Quận / Huyện',
    'Phường / Xã',
    'Địa chỉ chi tiết',
    'Tiền thu hộ COD (VNĐ)',
    'Khai giá / Giá trị hàng (VNĐ)',
    'Khối lượng (gram)',
    'Chiều dài (cm)',
    'Chiều rộng (cm)',
    'Chiều cao (cm)',
    'Người trả phí',
    'Cho xem hàng (Đồng kiểm)',
    'Tên sản phẩm & Ghi chú thiệp',
    'Trạng thái hiện tại',
    ];

    const rows = orders.map((order) => {
    const addr = order.shippingAddress;
    const codAmount = getCodCollectAmount(order);
    const itemsValue =
      order.items.reduce(
        (sum, i) => sum + (i.price ?? i.product.price) * i.quantity,
        0
      ) || order.total;
    const itemsText = order.items
      .map((i) => {
        const card = i.product.giftCardNote
          ? ` [Thiệp: ${i.product.giftCardNote}]`
          : '';
        return `${i.product.name} (x${i.quantity})${card}`;
      })
      .join(' + ');
    const noteText = addr?.note ? ` | Ghi chú: ${addr.note}` : '';

    return [
      order.id,
      addr?.fullName || 'Khách hàng',
      addr?.phone ? `'${addr.phone}` : '',
      addr?.city || '',
      addr?.district || '',
      addr?.ward || '',
      addr?.detailAddress || '',
      codAmount,
      itemsValue,
      250,
      15,
      15,
      10,
      'Người gửi trả (Shop trả)',
      'Cho xem hàng không thử',
      `${itemsText}${noteText}`,
      order.status,
    ]
      .map(escapeCsvCell)
      .join(',');
    });

    // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel & Goship.io read Vietnamese characters properly
    const csvContent = `\uFEFF${headers.map(escapeCsvCell).join(',')}\n${rows.join(
    '\n'
    )}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `goship-tiem-cuon-len-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return true;
    }
