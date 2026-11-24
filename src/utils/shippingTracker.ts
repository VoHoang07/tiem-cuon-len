import { ensureClientSupabaseAuthHeaders } from '@/services/supabase';
import type { CraftingStageKey } from '@/types/address';
import type { Order } from '@/types/order';
import { formatVND } from '@/utils/formatCurrency';

export interface CarrierInfo {
  id: string;
  name: string;
  shortLabel: string;
  portalUrl: string;
  buildTrackingUrl: (code: string) => string;
}

// SPX Express is #1 default carrier for Tiệm Cuộn Len (via Goship)
export const SHIPPING_CARRIERS: CarrierInfo[] = [
  {
    id: 'spx',
    name: 'SPX Express',
    shortLabel: 'SPX',
    portalUrl: 'https://spx.vn/',
    buildTrackingUrl: (code) =>
      code.trim()
        ? `https://spx.vn/track?${encodeURIComponent(code.trim())}`
        : 'https://spx.vn/',
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
    id: 'ghtk',
    name: 'Giao Hàng Tiết Kiệm (GHTK)',
    shortLabel: 'GHTK',
    portalUrl: 'https://i.ghtk.vn/',
    buildTrackingUrl: (code) => `https://i.ghtk.vn/${encodeURIComponent(code.trim())}`,
  },
  {
    id: 'viettel_post',
    name: 'Viettel Post',
    shortLabel: 'Viettel Post',
    portalUrl: 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/',
    buildTrackingUrl: () => 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/',
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
  { name: 'Goship.io (Tạo đơn SPX)', url: 'https://shop.goship.io' },
  { name: 'Tra cứu SPX.vn', url: 'https://spx.vn' },
  { name: 'GHN', url: 'https://khachhang.ghn.vn' },
  { name: 'GHTK', url: 'https://khachhang.giaohangtietkiem.vn' },
];

export const HANDMADE_CRAFTING_STAGES: {
  key: CraftingStageKey;
  shortLabel: string;
  customerTitle: string;
  customerDesc: string;
  progressPct: number;
}[] = [
  {
    key: 'yarn_prep',
    shortLabel: '🧶 Đã soạn màu len',
    customerTitle: 'Bước 1/4: Đã chốt mẫu & soạn cuộn len theo đơn',
    customerDesc:
      'Tiệm đã kiểm tra kỹ màu sắc, phụ kiện và lên khung chuẩn bị đan mới cho đơn của bạn.',
    progressPct: 28,
  },
  {
    key: 'crocheting',
    shortLabel: '🪡 Đang móc thủ công',
    customerTitle: 'Bước 2/4: Đang móc len thủ công từng chi tiết',
    customerDesc:
      'Thợ của tiệm đang tỉ mỉ móc tay từng mũi len để sản phẩm đứng form và đều đẹp nhất.',
    progressPct: 58,
  },
  {
    key: 'finishing_giftbox',
    shortLabel: '🎀 Ráp form & Viết thiệp',
    customerTitle: 'Bước 3/4: Đang khâu ráp form, kiểm tra & chuẩn bị hộp quà',
    customerDesc:
      'Sản phẩm đã hoàn thiện phần đan chính, đang khâu chi tiết nhỏ, lót rơm thơm & viết thiệp.',
    progressPct: 85,
  },
  {
    key: 'packed_waiting_spx',
    shortLabel: '📦 Đã gói xong chờ SPX',
    customerTitle: 'Bước 4/4: Đã đóng hộp hoàn tất — Chuẩn bị bàn giao SPX Express',
    customerDesc:
      'Gói hàng của bạn đã sẵn sàng! Mã vận đơn SPX sẽ hiển thị ngay khi bưu tá quét nhận.',
    progressPct: 96,
  },
];

export interface CraftingScheduleSummary {
  expectedShipWindowText: string;
  expectedDeliveryWindowText: string;
  activeStageTitle: string;
  activeStageDesc: string;
  progressPct: number;
  customNote?: string;
  updatedAt?: string;
}

function formatDayMonth(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Computes a reassuring handmade crafting schedule + expected SPX handover window (5–6 days from order date)
 * so customers waiting on Made-to-Order items always see clear progress even before an SPX tracking code exists.
 */
export function computeHandmadeCraftingSchedule(
  order: Order
): CraftingScheduleSummary {
  const createdMs = new Date(order.createdAt).getTime() || Date.now();
  const shipStart = new Date(createdMs + 5 * 24 * 3600 * 1000);
  const shipEnd = new Date(createdMs + 6 * 24 * 3600 * 1000);
  const deliverStart = new Date(createdMs + 7 * 24 * 3600 * 1000);
  const deliverEnd = new Date(createdMs + 9 * 24 * 3600 * 1000);

  const expectedShipWindowText = `${formatDayMonth(shipStart)} – ${formatDayMonth(
    shipEnd
  )}`;
  const expectedDeliveryWindowText = `${formatDayMonth(
    deliverStart
  )} – ${formatDayMonth(deliverEnd)}`;

  if (
    order.status === 'Đang giao' ||
    order.status === 'Hoàn thành' ||
    order.shippingAddress?.craftingStage === 'handed_to_spx' ||
    Boolean(order.shippingAddress?.trackingCode)
  ) {
    return {
      expectedShipWindowText,
      expectedDeliveryWindowText,
      activeStageTitle:
        'Đã hoàn thiện đan mẫu 100% & Bàn giao cho đơn vị vận chuyển',
      activeStageDesc:
        'Sản phẩm thủ công của bạn đã hoàn tất công đoạn đan móc, đóng gói hộp quà và bàn giao cho bưu cục SPX Express.',
      progressPct: 100,
      customNote: order.shippingAddress?.craftingNote,
      updatedAt:
        order.shippingAddress?.shippedAt ||
        order.shippingAddress?.craftingUpdatedAt,
    };
  }

  const explicitStageKey = order.shippingAddress?.craftingStage;
  const matchedExplicit = HANDMADE_CRAFTING_STAGES.find(
    (s) => s.key === explicitStageKey
  );

  if (matchedExplicit) {
    return {
      expectedShipWindowText,
      expectedDeliveryWindowText,
      activeStageTitle: matchedExplicit.customerTitle,
      activeStageDesc: matchedExplicit.customerDesc,
      progressPct: matchedExplicit.progressPct,
      customNote: order.shippingAddress?.craftingNote,
      updatedAt: order.shippingAddress?.craftingUpdatedAt,
    };
  }

  // Automatic time-based progression during the 5–6 day crafting window
  const elapsedDays = Math.max(
    0,
    (Date.now() - createdMs) / (24 * 3600 * 1000)
  );
  const autoStage =
    elapsedDays < 1.2
      ? HANDMADE_CRAFTING_STAGES[0]
      : elapsedDays < 3.8
        ? HANDMADE_CRAFTING_STAGES[1]
        : HANDMADE_CRAFTING_STAGES[2];

  return {
    expectedShipWindowText,
    expectedDeliveryWindowText,
    activeStageTitle: autoStage.customerTitle,
    activeStageDesc: autoStage.customerDesc,
    progressPct: autoStage.progressPct,
    customNote: order.shippingAddress?.craftingNote,
    updatedAt: order.shippingAddress?.craftingUpdatedAt,
  };
}

export function isCodOrder(order: Order): boolean {
  const pm = (order.paymentMethod || '').toLowerCase();
  return pm.includes('nhận hàng') || pm.includes('cod');
}

export function isUnpaidBankTransferOrder(order: Order): boolean {
  return !isCodOrder(order) && order.status === 'pending_payment';
}

export function getCodCollectAmount(order: Order): number {
  return isCodOrder(order) ? order.total : 0;
}

export function getFullAddressString(order: Order): string {
  const addr = order.shippingAddress;
  if (!addr) return 'Chưa có địa chỉ';
  if (order.isMaskedGuestView) {
    return addr.detailAddress || [addr.ward, addr.district, addr.city].filter(Boolean).join(', ');
  }
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
  const norm = (carrierLabel || 'spx').toLowerCase();
  if (norm.includes('spx') || norm.includes('shopee') || cleanCode.toUpperCase().startsWith('SPX')) {
    return cleanCode
      ? `https://spx.vn/track?${encodeURIComponent(cleanCode)}`
      : 'https://spx.vn/';
  }
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
    ? `https://spx.vn/track?${encodeURIComponent(cleanCode)}`
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
  const shipMethod = addr?.shippingMethod || 'Giao tiêu chuẩn (SPX)';
  const shipLower = shipMethod.toLowerCase();
  const isExpress =
    shipLower.includes('trong ngày') || shipLower.includes('hỏa tốc');

  return [
    `📦 ĐƠN HÀNG TIỆM CUỘN LEN — MÃ ĐỐI TÁC GOSHIP: ${order.id}`,
    `👤 Người nhận: ${addr?.fullName || 'Khách hàng'}`,
    `📞 SĐT: ${addr?.phone || '—'}`,
    `📍 Địa chỉ: ${fullAddress}`,
    addr?.note ? `📝 Ghi chú / Thiệp: ${addr.note}` : '',
    `🚚 Hình thức giao: ${shipMethod} (Ưu tiên chọn SPX Express trên Goship)`,
    isExpress
      ? '⚡ Cước ship Giao trong ngày (TP.HCM): Khách tự trả cước trực tiếp cho tài xế theo giá App'
      : '💳 Mục "Người trả phí" trên Goship: Chọn "Shop trả"',
    `💰 Ô "Thu hộ" (COD): ${
      codAmount > 0
        ? `${formatVND(codAmount)} (Đơn COD - Shipper thu của khách)`
        : order.status === 'pending_payment'
          ? `⛔ CẢNH BÁO: KHÁCH CHƯA CHUYỂN KHOẢN (${formatVND(order.total)}) — TUYỆT ĐỐI KHÔNG GỬI HÀNG!`
          : '0₫ (Khách ĐÃ CHUYỂN KHOẢN QR xác nhận - Điền số 0)'
    }`,
    `🛡️ Ô "Khai giá" (Giá trị hàng): ${formatVND(itemsValue || order.total)}`,
    `⚖️ Cân nặng gợi ý: 250g • Loại hàng: Đồ chơi / Quà tặng`,
    `🧶 Sản phẩm (${order.items.reduce((s, i) => s + i.quantity, 0)} món): ${itemsText}`,
    addr?.bonusGiftProductName
      ? `🎀 QUÀ TẶNG KÈM CẦN BỎ VÀO HỘP (Mã ${addr.promoCode || 'VD25'}): +01 ${addr.bonusGiftProductName} (0₫)`
      : '',
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

  const validPaidOrCodOrders = orders.filter(
    (o) => !isUnpaidBankTransferOrder(o) && o.status !== 'Đã hủy'
  );
  if (validPaidOrCodOrders.length === 0) return false;

  const rows = validPaidOrCodOrders.map((order) => {
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
    const bonusGiftText = addr?.bonusGiftProductName
      ? ` + [QUÀ TẶNG 0₫: ${addr.bonusGiftProductName}]`
      : '';
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
      `${itemsText}${bonusGiftText}${noteText}`,
      order.status,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csvContent = `\uFEFF${headers.map(escapeCsvCell).join(',')}\n${rows.join(
    '\n'
  )}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `goship-spx-tiem-cuon-len-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
}

// ─── CLIENT HELPERS FOR GUEST LOOKUP, LIVE SPX CHECKPOINTS & MANUAL GOSHIP DISPATCH ───

const GUEST_TRACKED_ORDERS_KEY = 'tcl_guest_tracked_orders_v1';
const GUEST_LAST_QUERY_KEY = 'tcl_guest_last_query_v1';

export function getCachedGuestTrackedOrders(): {
  lastQuery: string;
  orders: Order[];
} {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const lastQuery = window.sessionStorage.getItem(GUEST_LAST_QUERY_KEY) || '';
      const raw = window.sessionStorage.getItem(GUEST_TRACKED_ORDERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return { lastQuery, orders: parsed as Order[] };
        }
      }
      return { lastQuery, orders: [] };
    }
  } catch {
    // ignore
  }
  return { lastQuery: '', orders: [] };
}

function saveCachedGuestTrackedOrders(query: string, orders: Order[]) {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(GUEST_LAST_QUERY_KEY, query);
      window.sessionStorage.setItem(
        GUEST_TRACKED_ORDERS_KEY,
        JSON.stringify(orders.slice(0, 15))
      );
    }
  } catch {
    // ignore
  }
}

export async function lookupPublicOrdersByPhoneOrCode(query: string): Promise<{
  ok: boolean;
  orders: Order[];
  error?: string;
}> {
  const cleanQ = query.trim();
  if (!cleanQ) {
    return {
      ok: false,
      orders: [],
      error: 'Vui lòng nhập Số điện thoại nhận hàng hoặc Mã đơn hàng.',
    };
  }
  if (typeof window === 'undefined') {
    return { ok: false, orders: [], error: 'Không thể kết nối máy chủ.' };
  }
  try {
    const res = await fetch(
      `/api/shipping-tracker?action=lookup&q=${encodeURIComponent(cleanQ)}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
    );
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return {
        ok: false,
        orders: [],
        error: json?.error || 'Không thể tra cứu đơn hàng lúc này.',
      };
    }
    const list = Array.isArray(json.orders) ? (json.orders as Order[]) : [];
    saveCachedGuestTrackedOrders(cleanQ, list);
    return { ok: true, orders: list };
  } catch {
    return {
      ok: false,
      orders: [],
      error: 'Lỗi kết nối mạng. Vui lòng thử lại sau ít giây.',
    };
  }
}

export interface LiveCarrierCheckpoint {
  code: string;
  milestone: string;
  title: string;
  location: string;
  timestamp: string;
}

export async function fetchLiveCarrierJourney(
  trackingCode: string,
  carrier: string = 'SPX'
): Promise<{
  checkpoints: LiveCarrierCheckpoint[];
  source: string;
}> {
  const clean = (trackingCode || '').trim();
  if (!clean || typeof window === 'undefined') {
    return { checkpoints: [], source: 'none' };
  }
  try {
    const res = await fetch(
      `/api/shipping-tracker?action=carrier_journey&trackingCode=${encodeURIComponent(
        clean
      )}&carrier=${encodeURIComponent(carrier || 'SPX')}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
    );
    if (!res.ok) return { checkpoints: [], source: 'error' };
    const json = await res.json();
    return {
      checkpoints: Array.isArray(json?.checkpoints) ? json.checkpoints : [],
      source: String(json?.source || 'none'),
    };
  } catch {
    return { checkpoints: [], source: 'error' };
  }
}

export interface SyncedOrderGoshipPayload {
  id: string;
  status?: Order['status'];
  waybillReset?: boolean;
  changed?: boolean;
  shippingAddress: Partial<Order['shippingAddress']>;
}

/**
 * Automatically polls `/api/shipping-tracker?action=sync_orders` so logged-in customers and Admin
 * automatically receive SPX tracking codes & live station checkpoints (or detect cancelled waybills) from Goship!
 */
export async function syncActiveOrdersWithGoship(
  orderIds: string[],
  forceRefresh = false
): Promise<{
  ok: boolean;
  hasGoshipToken: boolean;
  syncedOrders: SyncedOrderGoshipPayload[];
}> {
  const cleanIds = Array.from(
    new Set((orderIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, 10);
  if (cleanIds.length === 0 || typeof window === 'undefined') {
    return { ok: false, hasGoshipToken: false, syncedOrders: [] };
  }
  try {
    const res = await fetch(
      `/api/shipping-tracker?action=sync_orders&orderIds=${encodeURIComponent(
        cleanIds.join(',')
      )}${forceRefresh ? '&force=1' : ''}&_t=${Date.now()}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
    );
    if (!res.ok) {
      return { ok: false, hasGoshipToken: false, syncedOrders: [] };
    }
    const json = await res.json();
    return {
      ok: Boolean(json?.success),
      hasGoshipToken: Boolean(json?.hasGoshipToken),
      syncedOrders: Array.isArray(json?.syncedOrders) ? json.syncedOrders : [],
    };
  } catch {
    return { ok: false, hasGoshipToken: false, syncedOrders: [] };
  }
}

export interface PublicWarehouseOrigin {
  senderName: string;
  fromCity: string;
  fromDistrict: string;
  fromWard: string;
}

let cachedPublicWarehouseOrigin: PublicWarehouseOrigin | null = null;
let cachedPublicWarehouseAt = 0;

export function clearCachedPublicWarehouseOrigin() {
  cachedPublicWarehouseOrigin = null;
  cachedPublicWarehouseAt = 0;
}

export async function fetchPublicWarehouseOrigin(
  force = false
): Promise<PublicWarehouseOrigin | null> {
  if (typeof window === 'undefined') return cachedPublicWarehouseOrigin;
  if (
    !force &&
    cachedPublicWarehouseOrigin &&
    Date.now() - cachedPublicWarehouseAt < 5 * 60 * 1000
  ) {
    return cachedPublicWarehouseOrigin;
  }
  try {
    const res = await fetch(
      `/api/shipping-tracker?action=public_warehouse_origin&_t=${Date.now()}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
    );
    if (!res.ok) return cachedPublicWarehouseOrigin;
    const json = await res.json();
    if (json?.success && json.origin) {
      cachedPublicWarehouseOrigin = json.origin as PublicWarehouseOrigin;
      cachedPublicWarehouseAt = Date.now();
      return cachedPublicWarehouseOrigin;
    }
  } catch {
    // ignore
  }
  return cachedPublicWarehouseOrigin;
}

async function getAdminBearerHeader(): Promise<Record<string, string>> {
  return ensureClientSupabaseAuthHeaders();
}

export interface AdminGoshipWarehouse {
  senderName: string;
  senderPhone: string;
  fromCity: string;
  fromDistrict: string;
  fromWard: string;
  fromStreet: string;
  fromCityCode?: string;
  fromDistrictCode?: string;
  fromWardCode?: string;
}

export interface GoshipLocationItem {
  id: string;
  name: string;
}

export interface GoshipRateOption {
  id: string;
  carrierName: string;
  carrierShort: string;
  service: string;
  expected: string;
  totalFee: number;
  isSpx: boolean;
}

export async function fetchAdminGoshipLocations(
  type: 'cities' | 'districts' | 'wards',
  parentId?: string
): Promise<{ ok: boolean; items: GoshipLocationItem[]; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, items: [] };
  try {
    const headers = await getAdminBearerHeader();
    const qs = new URLSearchParams({
      action: 'goship_locations',
      type,
      ...(parentId ? { parentId } : {}),
    });
    const res = await fetch(`/api/shipping-tracker?${qs.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      headers,
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return { ok: false, items: [], error: json?.error };
    }
    return {
      ok: true,
      items: Array.isArray(json.items) ? (json.items as GoshipLocationItem[]) : [],
    };
  } catch {
    return { ok: false, items: [], error: 'Không tải được danh sách địa giới Goship.' };
  }
}

export async function fetchAdminGoshipConfigStatus(): Promise<{
  hasGoshipToken: boolean;
  webhookUrl: string;
  warehouse: AdminGoshipWarehouse | null;
}> {
  if (typeof window === 'undefined') {
    return { hasGoshipToken: false, webhookUrl: '', warehouse: null };
  }
  try {
    const headers = await getAdminBearerHeader();
    const res = await fetch(
      `/api/shipping-tracker?action=goship_config_status&_t=${Date.now()}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers,
      }
    );
    if (!res.ok) {
      return { hasGoshipToken: false, webhookUrl: '', warehouse: null };
    }
    const json = await res.json();
    return {
      hasGoshipToken: Boolean(json?.hasGoshipToken),
      webhookUrl: String(json?.webhookUrl || ''),
      warehouse: (json?.warehouse as AdminGoshipWarehouse) || null,
    };
  } catch {
    return { hasGoshipToken: false, webhookUrl: '', warehouse: null };
  }
}

export async function saveAdminGoshipWarehouse(
  wh: AdminGoshipWarehouse
): Promise<{
  ok: boolean;
  warehouse?: AdminGoshipWarehouse;
  resolvedLocation?: { city: string; district: string; ward: string } | null;
  error?: string;
}> {
  try {
    const headers = await getAdminBearerHeader();
    const res = await fetch('/api/shipping-tracker', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'save_warehouse',
        ...wh,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || 'Không thể lưu kho lấy hàng.' };
    }
    clearCachedPublicWarehouseOrigin();
    return {
      ok: true,
      warehouse: json.warehouse as AdminGoshipWarehouse | undefined,
      resolvedLocation: json.resolvedLocation || null,
    };
  } catch {
    return { ok: false, error: 'Lỗi mạng khi lưu kho lấy hàng.' };
  }
}

export async function updateAdminCraftingProgress(params: {
  orderId: string;
  craftingStage: string;
  craftingNote?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers = await getAdminBearerHeader();
    const res = await fetch('/api/shipping-tracker', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'update_crafting',
        orderId: params.orderId,
        craftingStage: params.craftingStage,
        craftingNote: params.craftingNote || '',
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || 'Không cập nhật được tiến độ đan.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Lỗi mạng khi cập nhật tiến độ đan.' };
  }
}

export async function quoteAdminGoshipRates(
  orderId: string,
  weightGrams: number
): Promise<{
  ok: boolean;
  codAmount?: number;
  warehouse?: AdminGoshipWarehouse;
  resolvedFrom?: { city: string; district: string; ward: string; street?: string };
  resolvedTo?: { city: string; district: string; ward: string };
  rates?: GoshipRateOption[];
  error?: string;
}> {
  try {
    const headers = await getAdminBearerHeader();
    const res = await fetch('/api/shipping-tracker', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'goship_quote_spx',
        orderId,
        weightGrams,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || 'Không lấy được bảng phí Goship.' };
    }
    return {
      ok: true,
      codAmount: Number(json.codAmount || 0),
      warehouse: json.warehouse as AdminGoshipWarehouse | undefined,
      resolvedFrom: json.resolvedFrom,
      resolvedTo: json.resolvedTo,
      rates: Array.isArray(json.rates) ? json.rates : [],
    };
  } catch {
    return { ok: false, error: 'Lỗi kết nối khi báo giá Goship.' };
  }
}

export async function createAdminGoshipSpxShipment(params: {
  orderId: string;
  rateId: string;
  weightGrams: number;
}): Promise<{
  ok: boolean;
  trackingCode?: string;
  shippingCarrier?: string;
  goshipShipmentId?: string;
  error?: string;
}> {
  try {
    const headers = await getAdminBearerHeader();
    const res = await fetch('/api/shipping-tracker', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'goship_create_spx',
        orderId: params.orderId,
        rateId: params.rateId,
        weightGrams: params.weightGrams,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.error || 'Không thể tạo đơn trên Goship.' };
    }
    return {
      ok: true,
      trackingCode: String(json.trackingCode || ''),
      shippingCarrier: String(json.shippingCarrier || 'SPX'),
      goshipShipmentId: String(json.goshipShipmentId || ''),
    };
  } catch {
    return { ok: false, error: 'Lỗi kết nối khi tạo vận đơn Goship.' };
  }
}

export async function cancelAdminGoshipShipment(params: {
  orderId: string;
  forceUnlink?: boolean;
}): Promise<{
  ok: boolean;
  status?: Order['status'];
  goshipDeleted?: boolean;
  goshipAlreadyCancelled?: boolean;
  canForceUnlink?: boolean;
  error?: string;
}> {
  try {
    const headers = await getAdminBearerHeader();
    const res = await fetch('/api/shipping-tracker', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'goship_cancel_shipment',
        orderId: params.orderId,
        forceUnlink: Boolean(params.forceUnlink),
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return {
        ok: false,
        canForceUnlink: Boolean(json?.canForceUnlink),
        error: json?.error || 'Không thể huỷ / gỡ vận đơn lúc này.',
      };
    }
    return {
      ok: true,
      status: json.status as Order['status'] | undefined,
      goshipDeleted: Boolean(json.goshipDeleted),
      goshipAlreadyCancelled: Boolean(json.goshipAlreadyCancelled),
    };
  } catch {
    return { ok: false, error: 'Lỗi kết nối khi huỷ / gỡ vận đơn Goship.' };
  }
}
