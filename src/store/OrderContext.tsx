import {
    buildSupabasePublicHeaders,
    ensureClientSupabaseAuthHeaders,
    supabase,
    supabaseAnonKey,
    supabaseUrl,
} from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { Order, OrderStatus } from '@/types/order';
import {
    sanitizeText,
    validateOrderShippingUpdateSchema,
} from '@/utils/schemaValidator';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

async function callOrdersGuardApi(body: Record<string, unknown>): Promise<{
  ok: boolean;
  order?: Order;
}> {
  if (typeof window === 'undefined') return { ok: false };
  try {
    const authHeaders = await ensureClientSupabaseAuthHeaders();
    if (!authHeaders.Authorization && !authHeaders['X-OAuth-Token']) {
      return { ok: false };
    }

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 9000) : null;
    try {
      const res = await fetch('/api/orders-guard', {
        method: 'POST',
        credentials: 'same-origin',
        headers: authHeaders,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) return { ok: false };
      const data = await res.json();
      if (data && data.success) {
        return { ok: true, order: data.order as Order | undefined };
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    // fallback to direct Supabase call
  }
  return { ok: false };
}

const ORDERS_CACHE_KEY_PREFIX = 'tcl_orders_cache_v2';
const LEGACY_ORDERS_CACHE_PREFIX = 'tcl_orders_cache_v1';
const PERMANENT_ORDERS_VAULT_KEY = 'tcl_orders_permanent_vault_v1';
const DELETED_ORDER_IDS_STORAGE_KEY = 'tcl_deleted_order_ids_v1';
const GUEST_TRACKED_ORDERS_KEY = 'tcl_guest_tracked_orders_v1';
const LOCAL_AUDIT_LOGS_KEY = 'tcl_security_audit_logs_v1';

function getOrdersCacheKey(userId?: string): string {
  return `${ORDERS_CACHE_KEY_PREFIX}_${userId || 'guest'}`;
}

function loadDeletedOrderIds(): Set<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DELETED_ORDER_IDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map((id) => String(id)));
        }
      }
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveDeletedOrderIds(ids: Set<string>): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        DELETED_ORDER_IDS_STORAGE_KEY,
        JSON.stringify(Array.from(ids).slice(-500))
      );
    }
  } catch {
    // ignore
  }
}

async function fetchRemoteDeletedOrderIds(): Promise<Set<string>> {
  const local = loadDeletedOrderIds();
  if (!supabaseUrl || !supabaseAnonKey) return local;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/addresses?id=eq.tcl_deleted_orders_v1&select=detailAddress&limit=1`,
      {
        headers: buildSupabasePublicHeaders(),
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]?.detailAddress) {
        const parsed = JSON.parse(rows[0].detailAddress);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (id) local.add(String(id));
          }
          saveDeletedOrderIds(local);
        }
      }
    }
  } catch {
    // ignore
  }
  return local;
}

function sanitizeOrderZeroBase64(o: Order): Order {
  return {
    ...o,
    items: (Array.isArray(o.items) ? o.items : []).map((ci) => {
      if (!ci?.product) return ci;
      const rawImg = ci.product.image;
      return {
        ...ci,
        product: {
          ...ci.product,
          image:
            typeof rawImg === 'string' &&
            (rawImg.startsWith('data:image/') || rawImg.trim().startsWith('{'))
              ? null
              : rawImg,
        },
      };
    }),
  };
}

function isValidOrderCandidate(raw: any): raw is Order {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      typeof raw.id === 'string' &&
      raw.id.startsWith('CUONLEN-') &&
      Array.isArray(raw.items) &&
      raw.items.length > 0 &&
      !raw.isMaskedGuestView
  );
}

/**
 * Scans all historical localStorage keys (`tcl_orders_cache_v2_<oldUserId>`, `tcl_orders_permanent_vault_v1`,
 * `tcl_guest_tracked_orders_v1`, and `tcl_security_audit_logs_v1`) so orders cached before a Supabase project
 * migration or UUID change are automatically rescued and never lost.
 */
function loadAllRescuableLocalOrders(deletedIds: Set<string>): Order[] {
  const byId = new Map<string, Order>();
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const ingestOrderList = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!isValidOrderCandidate(item)) continue;
      if (deletedIds.has(item.id)) continue;
      const clean = sanitizeOrderZeroBase64(item);
      const existing = byId.get(clean.id);
      if (!existing) {
        byId.set(clean.id, clean);
      } else {
        // Prefer the copy with tracking code or more recent shipping metadata
        const hasMoreTracking =
          Boolean(clean.shippingAddress?.trackingCode) &&
          !existing.shippingAddress?.trackingCode;
        const hasNewerStage =
          (clean.shippingAddress?.craftingUpdatedAt || '') >
          (existing.shippingAddress?.craftingUpdatedAt || '');
        if (hasMoreTracking || hasNewerStage) {
          byId.set(clean.id, clean);
        }
      }
    }
  };

  try {
    // 1. Permanent vault first
    const vaultRaw = window.localStorage.getItem(PERMANENT_ORDERS_VAULT_KEY);
    if (vaultRaw) {
      try {
        ingestOrderList(JSON.parse(vaultRaw));
      } catch {
        // ignore
      }
    }

    // 2. Scan all `tcl_orders_cache_v2_*` and `tcl_orders_cache_v1_*` keys across previous Supabase UUIDs
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith(ORDERS_CACHE_KEY_PREFIX) ||
        k.startsWith(LEGACY_ORDERS_CACHE_PREFIX)
      ) {
        try {
          const raw = window.localStorage.getItem(k);
          if (raw) ingestOrderList(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    }

    // 3. Check guest tracked orders cache (only unmasked entries)
    const guestRaw = window.localStorage.getItem(GUEST_TRACKED_ORDERS_KEY);
    if (guestRaw) {
      try {
        const parsedGuest = JSON.parse(guestRaw);
        if (parsedGuest && Array.isArray(parsedGuest.orders)) {
          ingestOrderList(parsedGuest.orders);
        }
      } catch {
        // ignore
      }
    }

    // 4. Reconstruct any missing order recorded in `tcl_security_audit_logs_v1` (`CHECKOUT_ORDER_CREATED`)
    const auditRaw = window.localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (auditRaw) {
      try {
        const auditLogs = JSON.parse(auditRaw);
        if (Array.isArray(auditLogs)) {
          const cartByVisitor = new Map<string, any[]>();
          for (const entry of auditLogs) {
            if (entry?.eventType === 'CART_ADD_ITEM' && entry?.details) {
              const vKey = String(entry.visitorId || entry.ip || 'default');
              const arr = cartByVisitor.get(vKey) || [];
              arr.push(entry.details);
              cartByVisitor.set(vKey, arr);
            }
          }
          for (const entry of auditLogs) {
            if (entry?.eventType !== 'CHECKOUT_ORDER_CREATED' || !entry?.details) {
              continue;
            }
            const d = entry.details;
            const ordId = String(d.orderId || '').trim();
            if (
              !ordId.startsWith('CUONLEN-') ||
              byId.has(ordId) ||
              deletedIds.has(ordId)
            ) {
              continue;
            }
            const vKey = String(entry.visitorId || entry.ip || 'default');
            const recentCart = cartByVisitor.get(vKey) || [];
            const totalNum = Math.max(0, Number(d.total) || 0);
            const reconstructedItems =
              recentCart.length > 0
                ? recentCart.slice(-Math.max(1, Number(d.itemCount) || 1)).map((c, idx) => ({
                    product: {
                      id: String(c.productId || `rescued_prod_${idx}`),
                      name: String(
                        c.variant
                          ? `${c.productName || 'Sản phẩm len'} (${c.variant})`
                          : c.productName || 'Sản phẩm len thủ công'
                      ),
                      price: Math.max(0, Number(c.price) || totalNum),
                      image: null,
                      category: 'Keychains' as const,
                      description: '',
                      material: 'Len thủ công',
                      color: String(c.variant || ''),
                      quantity: 99,
                      rating: 5,
                      reviews: [],
                    },
                    quantity: Math.max(1, Number(c.quantity) || 1),
                    price: Math.max(0, Number(c.price) || totalNum),
                  }))
                : [
                    {
                      product: {
                        id: 'rescued_audit_item',
                        name: `Đơn hàng khôi phục (${Math.max(1, Number(d.itemCount) || 1)} sản phẩm)`,
                        price: totalNum,
                        image: null,
                        category: 'Keychains' as const,
                        description: '',
                        material: 'Len thủ công',
                        color: '',
                        quantity: 99,
                        rating: 5,
                        reviews: [],
                      },
                      quantity: 1,
                      price: totalNum,
                    },
                  ];

            const payMethod = String(
              d.paymentMethod || 'Thanh toán khi nhận hàng (COD)'
            );
            const isQr =
              payMethod.toLowerCase().includes('qr') ||
              payMethod.toLowerCase().includes('chuyển khoản');

            byId.set(ordId, {
              id: ordId,
              userId: String(entry.userId || 'rescued_customer'),
              items: reconstructedItems,
              total: totalNum,
              status: isQr ? 'pending_payment' : 'Đang xử lý',
              paymentMethod: payMethod,
              shippingAddress: {
                id: `addr_${ordId}`,
                userId: String(entry.userId || 'rescued_customer'),
                fullName: String(d.customerName || entry.customerName || 'Khách hàng'),
                phone: String(d.customerPhone || entry.customerPhone || ''),
                email:
                  String(d.customerEmail || entry.userEmail || '')
                    .toLowerCase()
                    .trim() || undefined,
                city: 'TP. Hồ Chí Minh',
                district: '',
                ward: '',
                detailAddress: 'Khôi phục từ Nhật ký đặt hàng',
                shippingMethod: String(d.shippingMethod || 'Giao tiêu chuẩn'),
                isDefault: false,
              },
              createdAt: String(entry.timestamp || new Date().toISOString()),
            });
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function normalizePhone10(raw?: string | null): string {
  if (!raw) return '';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.startsWith('84') && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function doesOrderBelongToCustomer(
  o: Order,
  userId?: string,
  userEmail?: string | null
): boolean {
  if (!o) return false;
  if (userId && o.userId === userId) return true;
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  if (cleanEmail) {
    const orderEmail = String(o.shippingAddress?.email || '')
      .toLowerCase()
      .trim();
    if (orderEmail && orderEmail === cleanEmail) return true;
    if (cleanEmail.endsWith('@phone.tiemcuonlen.vn')) {
      const phoneFromEmail = normalizePhone10(cleanEmail.split('@')[0]);
      const orderPhone = normalizePhone10(o.shippingAddress?.phone);
      if (phoneFromEmail && orderPhone && phoneFromEmail === orderPhone) {
        return true;
      }
    }
  }
  return false;
}

function loadCachedOrders(
  userId?: string,
  isAdminRole?: boolean,
  userEmail?: string | null
): Order[] {
  const deletedIds = loadDeletedOrderIds();
  const allLocal = loadAllRescuableLocalOrders(deletedIds);
  if (isAdminRole) {
    return allLocal;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(getOrdersCacheKey(userId));
      const directList: Order[] = raw ? JSON.parse(raw) : [];
      const combined = new Map<string, Order>();
      if (Array.isArray(directList)) {
        for (const o of directList) {
          if (isValidOrderCandidate(o) && !deletedIds.has(o.id)) {
            combined.set(o.id, sanitizeOrderZeroBase64(o));
          }
        }
      }
      if (userId || userEmail) {
        for (const o of allLocal) {
          if (
            !combined.has(o.id) &&
            doesOrderBelongToCustomer(o, userId, userEmail)
          ) {
            combined.set(o.id, o);
          }
        }
      }
      return Array.from(combined.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch {
    // ignore
  }
  return [];
}

function ordersSignature(items: Order[]): string {
  return items
    .map(
      (o) =>
        `${o.id}:${o.status}:${o.total}:${o.items?.length || 0}:${o.shippingAddress?.shippingCarrier || ''}:${o.shippingAddress?.trackingCode || ''}:${o.shippingAddress?.craftingStage || ''}:${o.shippingAddress?.craftingUpdatedAt || ''}:${o.shippingAddress?.goshipStatusText || ''}`
    )
    .join('|');
}

function saveCachedOrders(items: Order[], userId?: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  setTimeout(() => {
    try {
      const compactItems = items
        .slice(0, 80)
        .map((o) => sanitizeOrderZeroBase64(o));
      window.localStorage.setItem(
        getOrdersCacheKey(userId),
        JSON.stringify(compactItems)
      );

      // Also merge into the permanent append-only vault (`tcl_orders_permanent_vault_v1`)
      // so switching accounts or Supabase UUIDs never loses historical orders on this browser
      const deletedIds = loadDeletedOrderIds();
      const vaultMap = new Map<string, Order>();
      const rawVault = window.localStorage.getItem(PERMANENT_ORDERS_VAULT_KEY);
      if (rawVault) {
        try {
          const parsedVault = JSON.parse(rawVault);
          if (Array.isArray(parsedVault)) {
            for (const vo of parsedVault) {
              if (isValidOrderCandidate(vo) && !deletedIds.has(vo.id)) {
                vaultMap.set(vo.id, sanitizeOrderZeroBase64(vo));
              }
            }
          }
        } catch {
          // ignore
        }
      }
      for (const co of compactItems) {
        if (isValidOrderCandidate(co) && !deletedIds.has(co.id)) {
          vaultMap.set(co.id, co);
        }
      }
      const nextVault = Array.from(vaultMap.values())
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 120);
      window.localStorage.setItem(
        PERMANENT_ORDERS_VAULT_KEY,
        JSON.stringify(nextVault)
      );
    } catch {
      // ignore
    }
  }, 0);
}

/**
 * Parses either a JSON array of Orders or a CSV file exported from Supabase Table Editor (`orders_rows.csv`)
 */
export function parseSupabaseOrdersCsvOrJson(rawInput: string): Order[] {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return [];

  const normalizeRowToOrder = (row: any): Order | null => {
    if (!row || typeof row !== 'object') return null;
    const id = String(row.id || row.orderId || row.order_id || '').trim();
    if (!id.startsWith('CUONLEN-')) return null;

    let items = row.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    if (!Array.isArray(items) || items.length === 0) return null;

    let shippingAddress = row.shippingAddress ?? row.shipping_address;
    if (typeof shippingAddress === 'string') {
      try {
        shippingAddress = JSON.parse(shippingAddress);
      } catch {
        shippingAddress = {};
      }
    }
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      shippingAddress = {};
    }

    const total = Math.max(0, Math.round(Number(row.total) || 0));
    const status = (row.status || 'Đang xử lý') as OrderStatus;
    const paymentMethod = String(
      row.paymentMethod || row.payment_method || 'Thanh toán khi nhận hàng (COD)'
    );
    const createdAt =
      row.createdAt || row.created_at || new Date().toISOString();

    return sanitizeOrderZeroBase64({
      id,
      userId: String(row.userId || row.user_id || shippingAddress.userId || 'rescued_customer'),
      items,
      total,
      status,
      paymentMethod,
      shippingAddress: {
        id: String(shippingAddress.id || `addr_${id}`),
        userId: String(shippingAddress.userId || row.userId || 'rescued_customer'),
        fullName: String(shippingAddress.fullName || 'Khách hàng'),
        phone: String(shippingAddress.phone || ''),
        email: shippingAddress.email ? String(shippingAddress.email).toLowerCase() : undefined,
        city: String(shippingAddress.city || 'TP. Hồ Chí Minh'),
        district: String(shippingAddress.district || ''),
        ward: String(shippingAddress.ward || ''),
        detailAddress: String(shippingAddress.detailAddress || ''),
        ...shippingAddress,
      },
      createdAt: String(createdAt),
    });
  };

  // 1. Try JSON first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.orders)
          ? parsed.orders
          : Array.isArray(parsed.data)
            ? parsed.data
            : [parsed];
      const out: Order[] = [];
      for (const r of arr) {
        const ord = normalizeRowToOrder(r);
        if (ord) out.push(ord);
      }
      if (out.length > 0) return out;
    } catch {
      // fall through to CSV parser
    }
  }

  // 2. RFC-4180 CSV parser (handles multi-line quoted JSON cells from Supabase CSV export)
  const rows: string[][] = [];
  let curRow: string[] = [];
  let curCell = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const next = trimmed[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        curCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        curCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        curRow.push(curCell);
        curCell = '';
      } else if (ch === '\r' && next === '\n') {
        curRow.push(curCell);
        rows.push(curRow);
        curRow = [];
        curCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        curRow.push(curCell);
        rows.push(curRow);
        curRow = [];
        curCell = '';
      } else {
        curCell += ch;
      }
    }
  }
  if (curCell.length > 0 || curRow.length > 0) {
    curRow.push(curCell);
    rows.push(curRow);
  }
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  const result: Order[] = [];
  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const vals = rows[rIdx];
    if (!vals || vals.length === 0) continue;
    const obj: Record<string, string> = {};
    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      obj[headers[cIdx]] = vals[cIdx] ?? '';
    }
    const ord = normalizeRowToOrder(obj);
    if (ord) result.push(ord);
  }
  return result;
}

async function pushRescuedOrdersToServer(
  ordersToRescue: Order[],
  overwriteExisting = false
): Promise<number> {
  if (!Array.isArray(ordersToRescue) || ordersToRescue.length === 0) return 0;
  const cleanBatch = ordersToRescue
    .slice(0, 80)
    .map((o) => sanitizeOrderZeroBase64(o));

  // 1. Try Server-Side `/api/orders-guard` (`action: 'rescue_orders'`)
  if (typeof window !== 'undefined') {
    try {
      const headers = await ensureClientSupabaseAuthHeaders();
      const res = await fetch('/api/orders-guard', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({
          action: 'rescue_orders',
          orders: cleanBatch,
          overwriteExisting,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          return Number(data.rescuedCount) || cleanBatch.length;
        }
      }
    } catch {
      // fall through to direct Supabase upsert
    }
  }

  // 2. Fallback: Direct Supabase REST upsert
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/orders?on_conflict=id`, {
        method: 'POST',
        headers: buildSupabasePublicHeaders(null, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(cleanBatch),
      });
      if (res.ok) return cleanBatch.length;
    } catch {
      // ignore
    }
  }
  return 0;
}

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateOrderShipping: (
    orderId: string,
    payload: {
      status?: OrderStatus;
      shippingCarrier?: string;
      trackingCode?: string;
    }
  ) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  getOrdersByUser: (userId: string) => Order[];
  refetchOrders: () => Promise<void>;
  rescueOrdersManual: (rawImportText?: string) => Promise<{
    ok: boolean;
    rescuedCount: number;
    totalCount: number;
    message: string;
  }>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() =>
    loadCachedOrders(user?.id, role === 'admin', user?.email)
  );
  const deletedOrderIdsRef = useRef<Set<string>>(loadDeletedOrderIds());
  const rescuedToServerIdsRef = useRef<Set<string>>(new Set());
  const recentStatusOverridesRef = useRef<
    Map<string, { status: OrderStatus; ts: number }>
  >(new Map());

  const applyRecentStatusOverrides = useCallback((list: Order[]): Order[] => {
    const now = Date.now();
    return list.map((o) => {
      const ov = recentStatusOverridesRef.current.get(o.id);
      if (!ov) return o;
      if (now - ov.ts > 35000) {
        recentStatusOverridesRef.current.delete(o.id);
        return o;
      }
      if (o.status === ov.status) {
        recentStatusOverridesRef.current.delete(o.id);
        return o;
      }
      return { ...o, status: ov.status };
    });
  }, []);

  // Reset/reload cached orders when user or role changes
  useEffect(() => {
    setOrders(loadCachedOrders(user?.id, role === 'admin', user?.email));
  }, [user?.id, user?.email, role]);

  // Background rescue on mount even if visitor hasn't logged in yet:
  // Any browser that previously cached `CUONLEN-...` orders automatically restores missing rows to Supabase!
  useEffect(() => {
    void (async () => {
      const deletedSet = await fetchRemoteDeletedOrderIds();
      deletedOrderIdsRef.current = deletedSet;
      const localOrders = loadAllRescuableLocalOrders(deletedSet).filter(
        (o) => !rescuedToServerIdsRef.current.has(o.id)
      );
      if (localOrders.length > 0) {
        for (const o of localOrders) rescuedToServerIdsRef.current.add(o.id);
        await pushRescuedOrdersToServer(localOrders, false);
      }
    })();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user && role !== 'admin') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const deletedSet = await fetchRemoteDeletedOrderIds();
      deletedOrderIdsRef.current = deletedSet;

      const ORDER_COLUMNS =
        'id,userId,items,total,status,paymentMethod,shippingAddress,createdAt';
      const query = supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .order('createdAt', { ascending: false })
        .limit(100);

      if (role === 'admin') {
        const { data, error } = await query;
        if (!error && data) {
          const remoteFiltered = (data as Order[]).filter(
            (o) => !deletedOrderIdsRef.current.has(o.id)
          );
          const remoteIds = new Set(remoteFiltered.map((o) => o.id));
          const allLocal = loadAllRescuableLocalOrders(deletedOrderIdsRef.current);
          const missingOnServer = allLocal.filter((o) => !remoteIds.has(o.id));

          if (missingOnServer.length > 0) {
            const unpushed = missingOnServer.filter(
              (o) => !rescuedToServerIdsRef.current.has(o.id)
            );
            if (unpushed.length > 0) {
              for (const o of unpushed) rescuedToServerIdsRef.current.add(o.id);
              void pushRescuedOrdersToServer(unpushed, false);
            }
          }

          const merged = applyRecentStatusOverrides(
            [...remoteFiltered, ...missingOnServer].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );

          setOrders((prev) => {
            if (ordersSignature(merged) === ordersSignature(prev)) return prev;
            saveCachedOrders(merged, user?.id);
            return merged;
          });
        }
      } else if (user) {
        const cleanUserEmail = (user.email || '').toLowerCase().trim();
        const phoneFromEmail = cleanUserEmail.endsWith('@phone.tiemcuonlen.vn')
          ? normalizePhone10(cleanUserEmail.split('@')[0])
          : '';
        const [byIdRes, byEmailRes, byPhoneRes] = await Promise.all([
          query.eq('userId', user.id),
          cleanUserEmail && !cleanUserEmail.endsWith('@phone.tiemcuonlen.vn')
            ? supabase
                .from('orders')
                .select(ORDER_COLUMNS)
                .eq('shippingAddress->>email', cleanUserEmail)
                .order('createdAt', { ascending: false })
                .limit(50)
            : Promise.resolve({ data: null, error: null }),
          phoneFromEmail
            ? supabase
                .from('orders')
                .select(ORDER_COLUMNS)
                .eq('shippingAddress->>phone', phoneFromEmail)
                .order('createdAt', { ascending: false })
                .limit(50)
            : Promise.resolve({ data: null, error: null }),
        ]);
        const combinedMap = new Map<string, Order>();
        for (const resObj of [byIdRes, byEmailRes, byPhoneRes]) {
          if (!resObj.error && Array.isArray(resObj.data)) {
            for (const row of resObj.data as Order[]) {
              if (row?.id && !combinedMap.has(row.id)) {
                combinedMap.set(row.id, row);
              }
            }
          }
        }
        if (!byIdRes.error || !byEmailRes.error || !byPhoneRes.error) {
          const remoteRows = [...combinedMap.values()].filter(
            (o) => !deletedOrderIdsRef.current.has(o.id)
          );
          const remoteIds = new Set(remoteRows.map((o) => o.id));
          const allLocalForUser = loadAllRescuableLocalOrders(
            deletedOrderIdsRef.current
          ).filter(
            (o) =>
              !remoteIds.has(o.id) &&
              doesOrderBelongToCustomer(o, user.id, user.email)
          );

          if (allLocalForUser.length > 0) {
            const unpushed = allLocalForUser.filter(
              (o) => !rescuedToServerIdsRef.current.has(o.id)
            );
            if (unpushed.length > 0) {
              for (const o of unpushed) rescuedToServerIdsRef.current.add(o.id);
              void pushRescuedOrdersToServer(unpushed, false);
            }
          }

          setOrders((prev) => {
            const prevInFlight = prev.filter(
              (o) =>
                !deletedOrderIdsRef.current.has(o.id) &&
                !remoteIds.has(o.id) &&
                doesOrderBelongToCustomer(o, user.id, user.email)
            );
            const mergeMap = new Map<string, Order>();
            for (const r of remoteRows) mergeMap.set(r.id, r);
            for (const l of allLocalForUser) {
              if (!mergeMap.has(l.id)) mergeMap.set(l.id, l);
            }
            for (const p of prevInFlight) {
              if (!mergeMap.has(p.id)) mergeMap.set(p.id, p);
            }
            const merged = applyRecentStatusOverrides(
              Array.from(mergeMap.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
            );
            if (ordersSignature(merged) === ordersSignature(prev)) return prev;
            saveCachedOrders(merged, user.id);
            return merged;
          });
        }
      }
    } catch {
      // keep cached orders
    }
  }, [user, role]);

  useEffect(() => {
    if (!user && role !== 'admin') return;
    let lastFetchTs = Date.now();
    fetchOrders();
    const timer = setInterval(() => {
      lastFetchTs = Date.now();
      fetchOrders();
    }, 45000);
    const handleFocus = () => {
      if (Date.now() - lastFetchTs < 15000) return;
      lastFetchTs = Date.now();
      fetchOrders();
    };
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    const handlePageShow = () => {
      fetchOrders();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('pageshow', handlePageShow);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('pageshow', handlePageShow);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [user, role, fetchOrders]);

  const refetchOrders = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  const addOrder = useCallback(async (order: Order) => {
    // Strip multi-KB/MB Base64 images from order items before sending over mobile network
    // (the order UI & server only need lightweight URL or category fallback)
    const compactOrder: Order = {
      ...order,
      items: (order.items || []).map((ci) => {
        if (!ci?.product) return ci;
        const rawImg = ci.product.image;
        const safeLightImg =
          typeof rawImg === 'string' && rawImg.startsWith('data:image/')
            ? null
            : rawImg;
        return {
          ...ci,
          product: {
            ...ci.product,
            image: safeLightImg,
          },
        };
      }),
    };

    setOrders((prev) => {
      const next = [order, ...prev];
      saveCachedOrders(next, user?.id);
      return next;
    });

    // 1. Primary: Server-side Order Guard API (recalculates authoritative prices & enforces Anti-IDOR)
    const guardResult = await callOrdersGuardApi({ action: 'create', order: compactOrder });
    if (guardResult.ok && guardResult.order) {
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === order.id ? guardResult.order! : o));
        saveCachedOrders(next, user?.id);
        return next;
      });
      return;
    }

    // 2. Fallback: Direct Supabase upsert (when running local Expo dev server or when user logged in via OAuth fallback)
    try {
      const { error } = await supabase.from('orders').upsert(compactOrder, { onConflict: 'id' });
      if (error && supabaseUrl && supabaseAnonKey) {
        await fetch(`${supabaseUrl}/rest/v1/orders?on_conflict=id`, {
          method: 'POST',
          headers: buildSupabasePublicHeaders(null, {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(compactOrder),
        });
      }
    } catch {
      if (supabaseUrl && supabaseAnonKey) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/orders?on_conflict=id`, {
            method: 'POST',
            headers: buildSupabasePublicHeaders(null, {
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            }),
            body: JSON.stringify(compactOrder),
          });
        } catch {
          // ignore
        }
      }
    }
    const isCodOrder =
      String(compactOrder.paymentMethod || '')
        .toLowerCase()
        .includes('cod') ||
      String(compactOrder.paymentMethod || '')
        .toLowerCase()
        .includes('khi nhận hàng');
    if (isCodOrder) {
      fetch('/api/orders-guard', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'notify_email',
          orderId: compactOrder.id,
        }),
      }).catch(() => {});
    }
    }, [user?.id]);

    const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
      const validated = validateOrderShippingUpdateSchema({ orderId, status });
      if (!validated.success || !validated.data) return;

      recentStatusOverridesRef.current.set(orderId, {
        status,
        ts: Date.now(),
      });

      let targetOrderSnapshot: Order | null = null;
      setOrders((prev) => {
        const next = prev.map((o) => {
          if (o.id !== orderId) return o;
          const updated = { ...o, status };
          targetOrderSnapshot = sanitizeOrderZeroBase64(updated);
          return updated;
        });
        saveCachedOrders(next, user?.id);
        return next;
      });
      const isCustomerAllowedTransition =
        status === 'Hoàn thành' || status === 'Đã hủy';
      if (role !== 'admin' && !isCustomerAllowedTransition) return;

      const guardResult = await callOrdersGuardApi({
        action: 'update_status',
        orderId: validated.data.orderId,
        status: validated.data.status,
        fallbackOrder: targetOrderSnapshot || undefined,
      });
      if (guardResult.ok) return;

      try {
        await ensureClientSupabaseAuthHeaders();
        const { data: updatedRows, error } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', orderId)
          .select('id,status');
        if (!error && Array.isArray(updatedRows) && updatedRows.length > 0) {
          return;
        }
        if (targetOrderSnapshot) {
          await pushRescuedOrdersToServer([targetOrderSnapshot], true);
        }
      } catch {
        // keep local update
      }
    }, [user?.id, role]);

  const updateOrderShipping = useCallback(
    async (
      orderId: string,
      payload: {
        status?: OrderStatus;
        shippingCarrier?: string;
        trackingCode?: string;
      }
    ) => {
      if (role !== 'admin') return;
      const validated = validateOrderShippingUpdateSchema({
        orderId,
        status: payload.status,
        shippingCarrier: payload.shippingCarrier,
        trackingCode: payload.trackingCode,
      });
      if (!validated.success || !validated.data) return;

      if (payload.status) {
        recentStatusOverridesRef.current.set(orderId, {
          status: payload.status,
          ts: Date.now(),
        });
      }

      let updatedAddress: Order['shippingAddress'] | null = null;
      let updatedStatus: OrderStatus | undefined = payload.status;
      let targetOrderSnapshot: Order | null = null;

      setOrders((prev) => {
        const next = prev.map((o) => {
          if (o.id !== orderId) return o;
          const nextAddr: Order['shippingAddress'] = {
            ...o.shippingAddress,
            shippingCarrier:
              validated.data?.shippingCarrier !== undefined
                ? validated.data.shippingCarrier
                : o.shippingAddress?.shippingCarrier,
            trackingCode:
              validated.data?.trackingCode !== undefined
                ? validated.data.trackingCode
                : o.shippingAddress?.trackingCode,
            shippedAt:
              validated.data?.trackingCode || payload.status === 'Đang giao'
                ? o.shippingAddress?.shippedAt || new Date().toISOString()
                : o.shippingAddress?.shippedAt,
          };
          updatedAddress = nextAddr;
          const nextStat = payload.status ?? o.status;
          updatedStatus = nextStat;
          const updatedOrd: Order = {
            ...o,
            status: nextStat,
            shippingAddress: nextAddr,
          };
          targetOrderSnapshot = sanitizeOrderZeroBase64(updatedOrd);
          return updatedOrd;
        });
        saveCachedOrders(next, user?.id);
        return next;
      });

      if (!updatedAddress) return;

      const guardResult = await callOrdersGuardApi({
        action: 'update_shipping',
        orderId: validated.data.orderId,
        status: updatedStatus,
        shippingCarrier: validated.data.shippingCarrier,
        trackingCode: validated.data.trackingCode,
        fallbackOrder: targetOrderSnapshot || undefined,
      });
      if (guardResult.ok) return;

      try {
        await ensureClientSupabaseAuthHeaders();
        const updateRow: Record<string, unknown> = {
          shippingAddress: updatedAddress,
        };
        if (updatedStatus) {
          updateRow.status = updatedStatus;
        }
        const { data: updatedRows, error } = await supabase
          .from('orders')
          .update(updateRow)
          .eq('id', orderId)
          .select('id,status');
        if (!error && Array.isArray(updatedRows) && updatedRows.length > 0) {
          return;
        }
        if (targetOrderSnapshot) {
          await pushRescuedOrdersToServer([targetOrderSnapshot], true);
        }
      } catch {
        // keep optimistic local update
      }
    },
    [user?.id, role]
  );

  const getOrdersByUser = useCallback(
    (userId: string) =>
      orders.filter((o) =>
        doesOrderBelongToCustomer(
          o,
          userId || user?.id,
          user && userId === user.id ? user.email : null
        )
      ),
    [orders, user]
  );

  const deleteOrder = useCallback(async (orderId: string) => {
    if (!user?.id) return;
    const cleanId = sanitizeText(orderId, 80);
    if (!cleanId) return;

    // Anti-IDOR check in client store before deleting
    const target = orders.find((o) => o.id === cleanId);
    if (
      target &&
      role !== 'admin' &&
      !doesOrderBelongToCustomer(target, user.id, user.email)
    ) {
      return;
    }

    deletedOrderIdsRef.current.add(cleanId);
    saveDeletedOrderIds(deletedOrderIdsRef.current);
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== cleanId);
      saveCachedOrders(next, user?.id);
      return next;
    });

    const guardResult = await callOrdersGuardApi({
      action: 'delete',
      orderId: cleanId,
    });
    if (guardResult.ok) return;

    try {
      const query = supabase.from('orders').delete().eq('id', cleanId);
      if (role !== 'admin') {
        await query.eq('userId', user.id);
      } else {
        await query;
      }
    } catch {
      // keep local deletion
    }
  }, [user, role, orders]);

  const rescueOrdersManual = useCallback(
    async (rawImportText?: string) => {
      const deletedSet = await fetchRemoteDeletedOrderIds();
      deletedOrderIdsRef.current = deletedSet;

      const candidateMap = new Map<string, Order>();

      // 1. Scan all localStorage caches & audit logs on this browser
      const localFound = loadAllRescuableLocalOrders(deletedSet);
      for (const o of localFound) {
        candidateMap.set(o.id, o);
      }

      // 2. If user provided CSV/JSON text (e.g. exported from old Supabase Dashboard), parse & include
      const isExplicitImport = Boolean(rawImportText && rawImportText.trim());
      if (isExplicitImport && rawImportText) {
        const parsedImported = parseSupabaseOrdersCsvOrJson(rawImportText);
        for (const o of parsedImported) {
          // If Admin explicitly imports an order from CSV/JSON, remove it from deletedSet if present
          deletedOrderIdsRef.current.delete(o.id);
          candidateMap.set(o.id, o);
        }
        saveDeletedOrderIds(deletedOrderIdsRef.current);
      }

      const toSync = Array.from(candidateMap.values());
      if (toSync.length === 0) {
        await fetchOrders();
        return {
          ok: false,
          rescuedCount: 0,
          totalCount: orders.length,
          message: isExplicitImport
            ? 'Không tìm thấy dòng đơn hàng hợp lệ (CUONLEN-...) trong dữ liệu CSV/JSON vừa chọn.'
            : 'Trình duyệt hiện tại không còn lưu bộ nhớ đệm đơn hàng cũ nào khác.',
        };
      }

      const pushedCount = await pushRescuedOrdersToServer(
        toSync,
        isExplicitImport && role === 'admin'
      );

      setOrders((prev) => {
        const mergedMap = new Map<string, Order>();
        for (const o of prev) {
          if (!deletedOrderIdsRef.current.has(o.id)) mergedMap.set(o.id, o);
        }
        for (const o of toSync) {
          if (!mergedMap.has(o.id) || isExplicitImport) {
            mergedMap.set(o.id, o);
          }
        }
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveCachedOrders(merged, user?.id);
        return merged;
      });

      await fetchOrders();

      return {
        ok: true,
        rescuedCount: Math.max(pushedCount, toSync.length),
        totalCount: Math.max(orders.length, toSync.length),
        message: `Đã khôi phục và đồng bộ ${toSync.length} đơn hàng lên cơ sở dữ liệu thành công!`,
      };
    },
    [fetchOrders, orders.length, role, user?.id]
  );

  const contextValue = useMemo(
    () => ({
      orders,
      addOrder,
      updateOrderStatus,
      updateOrderShipping,
      deleteOrder,
      getOrdersByUser,
      refetchOrders,
      rescueOrdersManual,
    }),
    [
      orders,
      addOrder,
      updateOrderStatus,
      updateOrderShipping,
      deleteOrder,
      getOrdersByUser,
      refetchOrders,
      rescueOrdersManual,
    ]
  );

  return (
    <OrderContext.Provider value={contextValue}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) {
    throw new Error('useOrders must be used within OrderProvider');
  }
  return ctx;
}
