const crypto = require('crypto');
const {
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_SERVICE_KEY,
  HOLDER_USER_ID,
  extractClientTelemetry,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  verifyCsrfRequest,
  verifySupabaseUser,
  sendCustomerOrderLifecycleEmailServer,
  logServerAuditEvent,
  withGlobalErrorHandler,
} = require('./_securityCore');

const GOSHIP_CONFIG_ROW_ID = 'tcl_goship_sender_v1';
const GOSHIP_CONFIG_PARTITION = '__TCL_GOSHIP_CONFIG_V1__';

const GOSHIP_API_URL = (
  process.env.GOSHIP_API_URL || 'https://api.goship.io'
).replace(/\/+$/, '');
const GOSHIP_ACCESS_TOKEN = (process.env.GOSHIP_ACCESS_TOKEN || '').trim();
const GOSHIP_CLIENT_SECRET = (process.env.GOSHIP_CLIENT_SECRET || '').trim();

// Sliding-window rate limit for public phone/order lookup (prevents phone enumeration)
const lookupRateMap = new Map();
const LOOKUP_WINDOW_MS = 60 * 1000;
const MAX_LOOKUPS_PER_MIN = 20;

// In-memory cache for SPX live checkpoints (90 seconds TTL so page refreshes don't hammer spx.vn)
const spxCache = new Map();
const SPX_CACHE_TTL_MS = 90 * 1000;

// Cached Goship location tables in serverless warm memory
let cachedGoshipCities = null;
const cachedGoshipDistricts = new Map();
const cachedGoshipWards = new Map();

function checkLookupRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = lookupRateMap.get(key) || { ts: [] };
  entry.ts = entry.ts.filter((t) => now - t < LOOKUP_WINDOW_MS);
  entry.ts.push(now);
  lookupRateMap.set(key, entry);
  if (lookupRateMap.size > 1500) {
    const first = lookupRateMap.keys().next().value;
    if (first) lookupRateMap.delete(first);
  }
  return entry.ts.length <= MAX_LOOKUPS_PER_MIN;
}

function normalizeViText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\b(tinh|thanh pho|tp\.?|quan|huyen|thi xa|tx\.?|phuong|xa|thi tran|tt\.?)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function maskFullName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'Khách hàng';
  const parts = raw.split(/\s+/);
  return parts
    .map((p, idx) => {
      if (parts.length > 1 && idx === 0) return p;
      if (p.length <= 1) return '*';
      return `${p.slice(0, 1)}${'*'.repeat(Math.min(3, p.length - 1))}`;
    })
    .join(' ');
}

function maskPhone(phone) {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  if (clean.length < 7) return '***';
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

function buildMaskedPublicOrder(order) {
  const addr = order.shippingAddress || {};
  const locationTail = [addr.ward, addr.district, addr.city]
    .filter(Boolean)
    .join(', ');
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    isMaskedGuestView: true,
    items: (order.items || []).map((it) => ({
      quantity: it.quantity,
      price: it.price,
      product: {
        id: it.product && it.product.id,
        baseProductId: it.product && it.product.baseProductId,
        name: it.product && it.product.name,
        category: it.product && it.product.category,
        color: it.product && it.product.color,
        selectedColorName: it.product && it.product.selectedColorName,
        selectedAccessoryName: it.product && it.product.selectedAccessoryName,
        image:
          it.product &&
          typeof it.product.image === 'string' &&
          !it.product.image.startsWith('data:image/')
            ? it.product.image
            : null,
      },
    })),
    shippingAddress: {
      fullName: maskFullName(addr.fullName),
      phone: maskPhone(addr.phone),
      city: addr.city || '',
      district: addr.district || '',
      ward: addr.ward || '',
      detailAddress: locationTail ? `*** (Bảo mật số nhà), ${locationTail}` : '***',
      shippingMethod: addr.shippingMethod,
      shippingFee: addr.shippingFee,
      shippingCarrier: addr.shippingCarrier,
      trackingCode: addr.trackingCode,
      shippedAt: addr.shippedAt,
      promoCode: addr.promoCode,
      discountAmount: addr.discountAmount,
      bonusGiftProductName: addr.bonusGiftProductName,
      craftingStage: addr.craftingStage,
      craftingNote: addr.craftingNote,
      craftingUpdatedAt: addr.craftingUpdatedAt,
      goshipShipmentId: addr.goshipShipmentId,
      goshipStatusText: addr.goshipStatusText,
      goshipHistory: Array.isArray(addr.goshipHistory) ? addr.goshipHistory : [],
    },
  };
}

/**
 * Fetches live SPX checkpoints (`spx.vn`) from the Server with a clean 4s timeout & 90s cache.
 * Never throws — if SPX blocks cloud IPs or has no records yet, gracefully returns empty array so Goship history & spx.vn button still work!
 */
async function fetchLiveSpxCheckpoints(trackingCode) {
  const cleanCode = String(trackingCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (!cleanCode || cleanCode.length < 6) {
    return { checkpoints: [], source: 'none' };
  }

  const now = Date.now();
  const cached = spxCache.get(cleanCode);
  if (cached && now - cached.at < SPX_CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4200);
  try {
    const url = `https://spx.vn/shipment/order/open/order/get_order_info?spx_tn=${encodeURIComponent(
      cleanCode
    )}&language_code=vi`;
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
        cookie:
          'spx_token=0; spx_sid=0; login_status=true; nss_sys_type=true; nss_cid=VN',
        referer: 'https://spx.vn/track',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { checkpoints: [], source: 'unavailable' };
    }
    const json = await res.json();
    const records =
      json &&
      json.data &&
      json.data.sls_tracking_info &&
      Array.isArray(json.data.sls_tracking_info.records)
        ? json.data.sls_tracking_info.records
        : [];

    const checkpoints = records
      .filter((r) => r && (r.buyer_description || r.description || r.tracking_name))
      .map((r) => {
        const tsSec = Number(r.actual_time || 0);
        const isoTime =
          tsSec > 1000000000
            ? new Date(tsSec * 1000).toISOString()
            : new Date().toISOString();
        const locName =
          (r.current_location &&
            (r.current_location.location_name || r.current_location.full_address)) ||
          '';
        return {
          code: String(r.tracking_code || ''),
          milestone: String(r.milestone_name || ''),
          title: String(
            r.buyer_description || r.description || r.tracking_name || ''
          ).trim(),
          location: String(locName).trim(),
          timestamp: isoTime,
        };
      });

    const result = {
      checkpoints,
      source: checkpoints.length > 0 ? 'spx_live' : 'empty',
    };
    spxCache.set(cleanCode, { at: now, data: result });
    if (spxCache.size > 300) {
      const oldest = spxCache.keys().next().value;
      if (oldest) spxCache.delete(oldest);
    }
    return result;
  } catch {
    clearTimeout(timer);
    return { checkpoints: [], source: 'timeout_or_blocked' };
  }
}

async function callGoshipApi(path, method = 'GET', bodyObj = null) {
  if (!GOSHIP_ACCESS_TOKEN) {
    return {
      ok: false,
      status: 400,
      error:
        'Chưa cấu hình biến môi trường GOSHIP_ACCESS_TOKEN trên Vercel. Vui lòng thêm Token từ tài khoản Developer Goship.io.',
    };
  }
  const cleanAuth = GOSHIP_ACCESS_TOKEN.startsWith('Bearer ')
    ? GOSHIP_ACCESS_TOKEN
    : `Bearer ${GOSHIP_ACCESS_TOKEN}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9500);
  try {
    const res = await fetch(`${GOSHIP_API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: cleanAuth,
      },
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
    });
    clearTimeout(timer);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json.code && Number(json.code) >= 400)) {
      const errDetail =
        (json.data && json.data.errors && JSON.stringify(json.data.errors)) ||
        (json.data && json.data.error) ||
        json.message ||
        `Goship HTTP ${res.status}`;
      return { ok: false, status: res.status, error: String(errDetail), raw: json };
    }
    return { ok: true, data: json.data !== undefined ? json.data : json, raw: json };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 502,
      error: `Không kết nối được tới máy chủ Goship (${e && e.message ? e.message : 'Timeout'}).`,
    };
  }
}

async function resolveGoshipLocationCodes(cityName, districtName, wardName) {
  if (!cachedGoshipCities) {
    const cityRes = await callGoshipApi('/api/v2/cities', 'GET');
    if (!cityRes.ok || !Array.isArray(cityRes.data)) {
      return { ok: false, error: cityRes.error || 'Không tải được danh sách Tỉnh/Thành từ Goship.' };
    }
    cachedGoshipCities = cityRes.data;
  }

  const normCity = normalizeViText(cityName);
  const matchedCity =
    cachedGoshipCities.find((c) => {
      const n = normalizeViText(c.name);
      return (
        n === normCity ||
        n.includes(normCity) ||
        normCity.includes(n) ||
        (normCity.includes('hcm') && n.includes('ho chi minh')) ||
        (normCity.includes('sai gon') && n.includes('ho chi minh'))
      );
    }) || null;

  if (!matchedCity) {
    return {
      ok: false,
      error: `Không khớp được Tỉnh/Thành "${cityName}" trên Goship. Bạn kiểm tra lại địa chỉ nhé.`,
    };
  }

  const cityCode = String(matchedCity.id);
  let districts = cachedGoshipDistricts.get(cityCode);
  if (!districts) {
    const distRes = await callGoshipApi(`/api/v2/cities/${cityCode}/districts`, 'GET');
    if (!distRes.ok || !Array.isArray(distRes.data)) {
      return { ok: false, error: distRes.error || 'Không tải được danh sách Quận/Huyện từ Goship.' };
    }
    districts = distRes.data;
    cachedGoshipDistricts.set(cityCode, districts);
  }

  const normDist = normalizeViText(districtName);
  const matchedDist =
    districts.find((d) => {
      const n = normalizeViText(d.name);
      return n === normDist || n.includes(normDist) || normDist.includes(n);
    }) || districts[0];

  if (!matchedDist) {
    return {
      ok: false,
      error: `Không khớp được Quận/Huyện "${districtName}" trên Goship.`,
    };
  }

  const districtCode = String(matchedDist.id);
  let wards = cachedGoshipWards.get(districtCode);
  if (!wards) {
    const wardRes = await callGoshipApi(`/api/v2/districts/${districtCode}/wards`, 'GET');
    wards = wardRes.ok && Array.isArray(wardRes.data) ? wardRes.data : [];
    cachedGoshipWards.set(districtCode, wards);
  }

  const normWard = normalizeViText(wardName);
  const matchedWard =
    wards.find((w) => {
      const n = normalizeViText(w.name);
      return n === normWard || n.includes(normWard) || normWard.includes(n);
    }) || wards[0];

  return {
    ok: true,
    cityCode,
    districtCode,
    wardCode: matchedWard ? String(matchedWard.id) : '',
  };
}

async function getSavedSenderWarehouse(authToken) {
  const defaults = {
    senderName: process.env.GOSHIP_SENDER_NAME || 'Tiệm Cuộn Len',
    senderPhone: process.env.GOSHIP_SENDER_PHONE || '0387966507',
    fromCity: process.env.GOSHIP_FROM_CITY || 'Hồ Chí Minh',
    fromDistrict: process.env.GOSHIP_FROM_DISTRICT || 'Thành phố Thủ Đức',
    fromWard: process.env.GOSHIP_FROM_WARD || 'Phường Long Thạnh Mỹ',
    fromStreet: process.env.GOSHIP_FROM_STREET || 'Vinhomes Grand Park',
  };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?id=eq.${GOSHIP_CONFIG_ROW_ID}&select=detailAddress&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authToken || SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0] && rows[0].detailAddress) {
        const parsed = JSON.parse(rows[0].detailAddress);
        return { ...defaults, ...parsed };
      }
    }
  } catch {
    // ignore
  }
  return defaults;
}

function mapGoshipStatusToOrderStatus(statusCode, currentStatus) {
  const code = Number(statusCode);
  // 905: Giao thành công, 913: Hoàn thành
  if (code === 905 || code === 913) return 'Hoàn thành';
  // 901..904, 918, 919: Chờ lấy / Đã lấy / Đang vận chuyển / Đang giao
  if (
    code === 901 ||
    code === 902 ||
    code === 903 ||
    code === 904 ||
    code === 918 ||
    code === 919
  ) {
    return currentStatus === 'Hoàn thành' ? 'Hoàn thành' : 'Đang giao';
  }
  return currentStatus;
}

module.exports = withGlobalErrorHandler('/api/shipping-tracker', async function handler(req, res) {
  const telemetry = extractClientTelemetry(req);

  // ─── 1. GOSHIP WEBHOOK LISTENER (AUTO-ATTACH SPX TRACKING CODE & SYNC JOURNEY) ───
  const goshipHmacHeader = String(
    (req.headers && (req.headers['x-goship-hmac-sha256'] || req.headers['X-Goship-Hmac-SHA256'])) ||
      ''
  ).trim();
  const isWebhookQuery = req.query && req.query.webhook === 'goship';

  if (req.method === 'POST' && (goshipHmacHeader || isWebhookQuery)) {
    const rawStr =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const webhookBody =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (GOSHIP_CLIENT_SECRET) {
      if (!goshipHmacHeader) {
        return res.status(401).json({ success: false, error: 'Missing Goship HMAC header' });
      }
      const computedBase64 = crypto
        .createHmac('sha256', GOSHIP_CLIENT_SECRET)
        .update(rawStr)
        .digest('base64');
      const computedFromObj = crypto
        .createHmac('sha256', GOSHIP_CLIENT_SECRET)
        .update(JSON.stringify(webhookBody))
        .digest('base64');
      if (goshipHmacHeader !== computedBase64 && goshipHmacHeader !== computedFromObj) {
        return res.status(401).json({ success: false, error: 'Invalid Goship HMAC signature' });
      }
    } else if (isWebhookQuery) {
      const secretParam = String((req.query && req.query.secret) || '').trim();
      const expectedHookSecret = String(
        process.env.GOSHIP_WEBHOOK_SECRET || process.env.SEPAY_WEBHOOK_SECRET || ''
      ).trim();
      if (expectedHookSecret && secretParam !== expectedHookSecret) {
        return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
      }
    }

    const cleanHook = stripUnknownFieldsServer(webhookBody, [
      'gcode',
      'code',
      'order_id',
      'status',
      'status_text',
      'message',
      'description',
      'tracking_url',
      'carrier_short_name',
      'fee',
      'cod',
      'update_time',
    ]);

    const partnerOrderId = sanitizeTextServer(cleanHook.order_id || '', 80);
    const carrierTrackingCode = sanitizeTextServer(cleanHook.code || cleanHook.gcode || '', 60);
    const gcode = sanitizeTextServer(cleanHook.gcode || '', 60);
    const statusText = sanitizeTextServer(cleanHook.status_text || '', 80);
    const statusDesc = sanitizeTextServer(
      cleanHook.description || cleanHook.message || statusText,
      200
    );
    const carrierShort = sanitizeTextServer(
      cleanHook.carrier_short_name || 'shopee',
      30
    ).toLowerCase();

    if (!partnerOrderId && !gcode && !carrierTrackingCode) {
      return res.status(200).json({ success: true, ignored: true });
    }

    // Match order by `order_id` (`CUONLEN-...`) first, or by previously saved `goshipShipmentId` / `trackingCode`
    let matchedOrder = null;
    const dbHeaders = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    };

    if (partnerOrderId) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(
          partnerOrderId
        )}&select=*&limit=1`,
        { headers: dbHeaders }
      );
      const rows = r.ok ? await r.json() : [];
      matchedOrder = Array.isArray(rows) ? rows[0] : null;
    }

    if (!matchedOrder && (gcode || carrierTrackingCode)) {
      const rRecent = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=*&order=createdAt.desc&limit=80`,
        { headers: dbHeaders }
      );
      const recentRows = rRecent.ok ? await rRecent.json() : [];
      if (Array.isArray(recentRows)) {
        matchedOrder =
          recentRows.find((o) => {
            const a = o && o.shippingAddress;
            if (!a) return false;
            return (
              (gcode && a.goshipShipmentId === gcode) ||
              (carrierTrackingCode && a.trackingCode === carrierTrackingCode)
            );
          }) || null;
      }
    }

    if (!matchedOrder) {
      return res.status(200).json({ success: true, matched: false });
    }

    const prevAddr = matchedOrder.shippingAddress || {};
    const prevHistory = Array.isArray(prevAddr.goshipHistory)
      ? prevAddr.goshipHistory
      : [];
    const tsIso = cleanHook.update_time
      ? new Date(Number(cleanHook.update_time) * 1000).toISOString()
      : new Date().toISOString();

    const carrierDisplay =
      carrierShort === 'shopee' || carrierShort === 'spx'
        ? 'SPX'
        : carrierShort.toUpperCase() || prevAddr.shippingCarrier || 'SPX';

    const newCheckpoint = {
      status: Number(cleanHook.status) || 900,
      statusText: statusText || 'Cập nhật vận đơn',
      description: statusDesc,
      timestamp: tsIso,
    };

    const dedupedHistory = [
      newCheckpoint,
      ...prevHistory.filter(
        (h) => !(h.status === newCheckpoint.status && h.description === newCheckpoint.description)
      ),
    ].slice(0, 25);

    const nextOrderStatus = mapGoshipStatusToOrderStatus(
      cleanHook.status,
      matchedOrder.status
    );
    const prevTracking = prevAddr.trackingCode || '';
    const finalTracking = carrierTrackingCode || prevTracking;

    const updatedAddress = {
      ...prevAddr,
      shippingCarrier: carrierDisplay,
      trackingCode: finalTracking,
      goshipShipmentId: gcode || prevAddr.goshipShipmentId,
      goshipStatusText: statusText || prevAddr.goshipStatusText,
      goshipHistory: dedupedHistory,
      shippedAt:
        finalTracking || nextOrderStatus === 'Đang giao'
          ? prevAddr.shippedAt || tsIso
          : prevAddr.shippedAt,
    };

    await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(matchedOrder.id)}`,
      {
        method: 'PATCH',
        headers: {
          ...dbHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: nextOrderStatus,
          shippingAddress: updatedAddress,
        }),
      }
    );

    const updatedOrderObj = {
      ...matchedOrder,
      status: nextOrderStatus,
      shippingAddress: updatedAddress,
    };

    if (finalTracking && finalTracking !== prevTracking) {
      await sendCustomerOrderLifecycleEmailServer(updatedOrderObj, 'shipped');
    } else if (
      nextOrderStatus === 'Hoàn thành' &&
      matchedOrder.status !== 'Hoàn thành'
    ) {
      await sendCustomerOrderLifecycleEmailServer(updatedOrderObj, 'completed');
    }

    return res.status(200).json({
      success: true,
      matchedOrderId: matchedOrder.id,
      trackingCode: finalTracking,
      status: nextOrderStatus,
    });
  }

  // All browser requests below enforce CSRF check
  const csrf = verifyCsrfRequest(req);
  if (!csrf.valid) {
    return res.status(403).json({
      success: false,
      error: 'Yêu cầu bị từ chối bởi CSRF Guard.',
    });
  }

  // ─── 2. GET: LIVE TRACKING CHECKPOINTS OR PUBLIC GUEST LOOKUP ───────────────
  if (req.method === 'GET') {
    const query = req.query || {};
    const action = sanitizeTextServer(query.action || 'lookup', 40);

    // 2A. Live Carrier Checkpoints (SPX Live + Saved Goship History)
    if (action === 'carrier_journey') {
      if (!checkLookupRateLimit(telemetry.ip)) {
        return res.status(429).json({
          success: false,
          error: 'Bạn thao tác quá nhanh, vui lòng đợi ít giây.',
        });
      }
      const trackingCode = sanitizeTextServer(query.trackingCode || '', 60);
      const carrier = sanitizeTextServer(query.carrier || 'SPX', 40).toLowerCase();

      if (!trackingCode) {
        return res.status(200).json({ success: true, checkpoints: [], source: 'none' });
      }

      if (
        carrier.includes('spx') ||
        carrier.includes('shopee') ||
        trackingCode.toUpperCase().startsWith('SPX')
      ) {
        const spxData = await fetchLiveSpxCheckpoints(trackingCode);
        return res.status(200).json({
          success: true,
          trackingCode,
          ...spxData,
        });
      }

      // If Goship token is configured and we have a Goship code, try Goship track API
      if (GOSHIP_ACCESS_TOKEN) {
        const gsTrack = await callGoshipApi(
          `/api/v2/shipments/search?code=${encodeURIComponent(trackingCode)}`,
          'GET'
        );
        if (gsTrack.ok && Array.isArray(gsTrack.data) && gsTrack.data[0]) {
          const hist = Array.isArray(gsTrack.data[0].history)
            ? gsTrack.data[0].history
            : [];
          return res.status(200).json({
            success: true,
            trackingCode,
            source: 'goship_api',
            checkpoints: hist.map((h) => ({
              code: String(h.status || ''),
              milestone: String(h.status_text || ''),
              title: String(h.status_desc || h.status_text || ''),
              location: '',
              timestamp: h.updated_time
                ? new Date(Number(h.updated_time) * 1000).toISOString()
                : new Date().toISOString(),
            })),
          });
        }
      }

      return res.status(200).json({ success: true, checkpoints: [], source: 'portal_only' });
    }

    // 2B. Admin Sender Warehouse Config Status
    if (action === 'goship_config_status') {
      const authUser = await verifySupabaseUser(req);
      if (!authUser || !authUser.isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const warehouse = await getSavedSenderWarehouse(authUser.accessToken);
      return res.status(200).json({
        success: true,
        hasGoshipToken: Boolean(GOSHIP_ACCESS_TOKEN),
        webhookUrl: 'https://www.tiemcuonlen.shop/api/shipping-tracker?webhook=goship',
        warehouse,
      });
    }

    // 2C. Public Guest Lookup by Phone Number or Order ID (Privacy-Masked!)
    if (!checkLookupRateLimit(telemetry.ip)) {
      await logServerAuditEvent(req, {
        eventType: 'RATE_LIMIT_TRIGGERED',
        severity: 'WARNING',
        path: '/api/shipping-tracker',
        details: { reason: 'ORDER_LOOKUP_RATE_LIMIT' },
      });
      return res.status(429).json({
        success: false,
        error: 'Bạn tra cứu quá nhiều lần trong 1 phút. Vui lòng đợi ít giây rồi thử lại nhé.',
      });
    }

    const rawQ = sanitizeTextServer(query.q || '', 80).trim();
    if (!rawQ || rawQ.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập Số điện thoại nhận hàng (10 số) hoặc Mã đơn hàng (VD: CUONLEN-...).',
      });
    }

    const digitsOnly = rawQ.replace(/[^0-9]/g, '').replace(/^84/, '0');
    const isPhoneQuery = /^0[35789]\d{8}$/.test(digitsOnly);
    const upperQ = rawQ.toUpperCase().replace(/^#/, '');

    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?select=id,userId,items,total,status,paymentMethod,shippingAddress,createdAt&order=createdAt.desc&limit=150`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const allRecent = dbRes.ok ? await dbRes.json() : [];
    const matched = [];

    if (Array.isArray(allRecent)) {
      for (const ord of allRecent) {
        if (!ord || !ord.id) continue;
        const ordIdUpper = String(ord.id).toUpperCase();
        const addrPhone = String(
          (ord.shippingAddress && ord.shippingAddress.phone) || ''
        )
          .replace(/[^0-9]/g, '')
          .replace(/^84/, '0');
        const trackUpper = String(
          (ord.shippingAddress && ord.shippingAddress.trackingCode) || ''
        ).toUpperCase();

        if (isPhoneQuery && addrPhone === digitsOnly) {
          matched.push(buildMaskedPublicOrder(ord));
        } else if (
          !isPhoneQuery &&
          upperQ.length >= 6 &&
          (ordIdUpper === upperQ ||
            ordIdUpper.endsWith(upperQ) ||
            (trackUpper && trackUpper === upperQ))
        ) {
          matched.push(buildMaskedPublicOrder(ord));
        }
      }
    }

    return res.status(200).json({
      success: true,
      orders: matched.slice(0, 15),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // ─── 3. AUTHENTICATED ADMIN ACTIONS (CRAFTING PROGRESS & MANUAL GOSHIP SPX DISPATCH) ───
  const authUser = await verifySupabaseUser(req);
  if (!authUser || !authUser.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Chỉ Quản trị viên mới có quyền thực hiện thao tác vận đơn này.',
    });
  }

  const rawBody =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const action = sanitizeTextServer(rawBody.action || '', 40);

  // 3A. Save Admin Sender Pickup Warehouse Config
  if (action === 'save_warehouse') {
    const cleanWh = stripUnknownFieldsServer(rawBody, [
      'senderName',
      'senderPhone',
      'fromCity',
      'fromDistrict',
      'fromWard',
      'fromStreet',
    ]);
    const whObj = {
      senderName: sanitizeTextServer(cleanWh.senderName || 'Tiệm Cuộn Len', 80),
      senderPhone: sanitizeTextServer(cleanWh.senderPhone || '', 20).replace(/[^0-9+]/g, ''),
      fromCity: sanitizeTextServer(cleanWh.fromCity || 'Hồ Chí Minh', 80),
      fromDistrict: sanitizeTextServer(cleanWh.fromDistrict || '', 80),
      fromWard: sanitizeTextServer(cleanWh.fromWard || '', 80),
      fromStreet: sanitizeTextServer(cleanWh.fromStreet || '', 180),
    };
    await fetch(`${SUPABASE_URL}/rest/v1/addresses?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${authUser.accessToken || SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: GOSHIP_CONFIG_ROW_ID,
        userId: HOLDER_USER_ID,
        fullName: GOSHIP_CONFIG_PARTITION,
        phone: whObj.senderPhone || '0387966507',
        city: whObj.fromCity,
        district: new Date().toISOString(),
        ward: 'GOSHIP_WAREHOUSE',
        detailAddress: JSON.stringify(whObj),
        isDefault: false,
      }),
    });
    return res.status(200).json({ success: true, warehouse: whObj });
  }

  // 3B. Admin 1-Tap Update Handmade Crafting Progress (Reassures customer during 5–6 day wait!)
  if (action === 'update_crafting') {
    const cleanCraft = stripUnknownFieldsServer(rawBody, [
      'orderId',
      'craftingStage',
      'craftingNote',
    ]);
    const orderId = sanitizeTextServer(cleanCraft.orderId || '', 80);
    const craftingStage = sanitizeTextServer(cleanCraft.craftingStage || '', 60);
    const craftingNote = sanitizeTextServer(cleanCraft.craftingNote || '', 240);
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng.' });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const rows = r.ok ? await r.json() : [];
    const existing = Array.isArray(rows) ? rows[0] : null;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng.' });
    }

    const updatedAddr = {
      ...(existing.shippingAddress || {}),
      craftingStage: craftingStage || undefined,
      craftingNote: craftingNote || undefined,
      craftingUpdatedAt: new Date().toISOString(),
    };
    const nextStatus =
      existing.status === 'Đang xử lý' && craftingStage === 'packed_waiting_spx'
        ? 'Đang chuẩn bị hàng'
        : existing.status;

    await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: nextStatus,
          shippingAddress: updatedAddr,
        }),
      }
    );

    return res.status(200).json({
      success: true,
      orderId,
      status: nextStatus,
      shippingAddress: updatedAddr,
    });
  }

  // 3C. Step 1 of Manual Goship Dispatch: Quote SPX Rates ONLY when Admin clicks preview!
  if (action === 'goship_quote_spx') {
    const cleanQuote = stripUnknownFieldsServer(rawBody, ['orderId', 'weightGrams']);
    const orderId = sanitizeTextServer(cleanQuote.orderId || '', 80);
    const weightGrams = Math.max(50, Math.min(20000, Number(cleanQuote.weightGrams) || 250));

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const rows = r.ok ? await r.json() : [];
    const order = Array.isArray(rows) ? rows[0] : null;
    if (!order) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng.' });
    }
    if (order.status === 'pending_payment') {
      return res.status(400).json({
        success: false,
        error:
          '⛔ Đơn chuyển khoản này KHÁCH CHƯA THANH TOÁN (Chờ quét QR)! Hệ thống chặn tạo đơn ship để tránh gửi hàng thu hộ 0₫ khi chưa nhận được tiền.',
      });
    }

    const warehouse = await getSavedSenderWarehouse(authUser.accessToken);
    const fromLoc = await resolveGoshipLocationCodes(
      warehouse.fromCity,
      warehouse.fromDistrict,
      warehouse.fromWard
    );
    if (!fromLoc.ok) {
      return res.status(400).json({ success: false, error: `Kho gửi: ${fromLoc.error}` });
    }

    const toAddr = order.shippingAddress || {};
    const toLoc = await resolveGoshipLocationCodes(
      toAddr.city,
      toAddr.district,
      toAddr.ward
    );
    if (!toLoc.ok) {
      return res.status(400).json({ success: false, error: `Địa chỉ khách: ${toLoc.error}` });
    }

    const isCod =
      String(order.paymentMethod || '')
        .toLowerCase()
        .includes('cod') ||
      String(order.paymentMethod || '')
        .toLowerCase()
        .includes('nhận hàng');
    const codAmount = isCod ? Math.round(Number(order.total) || 0) : 0;
    const parcelValue = Math.round(Number(order.total) || 100000);

    const rateRes = await callGoshipApi('/api/v2/rates', 'POST', {
      shipment: {
        address_from: {
          city: fromLoc.cityCode,
          district: fromLoc.districtCode,
        },
        address_to: {
          city: toLoc.cityCode,
          district: toLoc.districtCode,
        },
        parcel: {
          cod: codAmount,
          amount: parcelValue,
          weight: weightGrams,
          length: 15,
          width: 15,
          height: 10,
        },
      },
    });

    if (!rateRes.ok || !Array.isArray(rateRes.data)) {
      return res.status(400).json({
        success: false,
        error: rateRes.error || 'Không lấy được bảng cước từ Goship.',
      });
    }

    // Sort so SPX (`carrier_short_name === 'shopee'`) is always #1 at the top!
    const sortedRates = [...rateRes.data]
      .map((rt) => ({
        id: String(rt.id || rt.rate || ''),
        carrierName: String(rt.carrier_name || ''),
        carrierShort: String(rt.carrier_short_name || '').toLowerCase(),
        service: String(rt.service || ''),
        expected: String(rt.expected || ''),
        totalFee: Number(rt.total_fee || rt.total_amount || 0),
        isSpx:
          String(rt.carrier_short_name || '').toLowerCase() === 'shopee' ||
          String(rt.carrier_name || '').toLowerCase().includes('spx') ||
          String(rt.carrier_name || '').toLowerCase().includes('shopee'),
      }))
      .sort((a, b) => {
        if (a.isSpx && !b.isSpx) return -1;
        if (!a.isSpx && b.isSpx) return 1;
        return a.totalFee - b.totalFee;
      });

    return res.status(200).json({
      success: true,
      codAmount,
      weightGrams,
      warehouse,
      rates: sortedRates,
    });
  }

  // 3D. Step 2 of Manual Goship Dispatch: Confirm & Create SPX Shipment on Goship (Strictly Idempotent!)
  if (action === 'goship_create_spx') {
    const cleanCreate = stripUnknownFieldsServer(rawBody, [
      'orderId',
      'rateId',
      'weightGrams',
    ]);
    const orderId = sanitizeTextServer(cleanCreate.orderId || '', 80);
    const chosenRateId = sanitizeTextServer(cleanCreate.rateId || '', 120);
    const weightGrams = Math.max(50, Math.min(20000, Number(cleanCreate.weightGrams) || 250));

    if (!orderId || !chosenRateId) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu mã đơn hàng hoặc gói cước vận chuyển (rateId).',
      });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const rows = r.ok ? await r.json() : [];
    const order = Array.isArray(rows) ? rows[0] : null;
    if (!order) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng.' });
    }
    if (order.status === 'pending_payment') {
      return res.status(400).json({
        success: false,
        error:
          '⛔ Đơn chuyển khoản này KHÁCH CHƯA THANH TOÁN (Chờ quét QR)! Không thể tạo vận đơn thu hộ 0₫ khi tiền chưa về.',
      });
    }

    // Strict Idempotency Guard: Never create a duplicate Goship waybill if this order already has one!
    if (
      order.shippingAddress &&
      (order.shippingAddress.goshipShipmentId || order.shippingAddress.trackingCode)
    ) {
      return res.status(400).json({
        success: false,
        error: `Đơn hàng này đã có mã vận đơn (${
          order.shippingAddress.trackingCode || order.shippingAddress.goshipShipmentId
        }) rồi — Hệ thống tự khóa để không tạo trùng 2 đơn ship!`,
      });
    }

    const warehouse = await getSavedSenderWarehouse(authUser.accessToken);
    const fromLoc = await resolveGoshipLocationCodes(
      warehouse.fromCity,
      warehouse.fromDistrict,
      warehouse.fromWard
    );
    const toAddr = order.shippingAddress || {};
    const toLoc = await resolveGoshipLocationCodes(
      toAddr.city,
      toAddr.district,
      toAddr.ward
    );
    if (!fromLoc.ok || !toLoc.ok) {
      return res.status(400).json({
        success: false,
        error: fromLoc.error || toLoc.error || 'Không phân giải được mã địa chỉ Goship.',
      });
    }

    const isCod =
      String(order.paymentMethod || '')
        .toLowerCase()
        .includes('cod') ||
      String(order.paymentMethod || '')
        .toLowerCase()
        .includes('nhận hàng');
    const codAmount = isCod ? Math.round(Number(order.total) || 0) : 0;
    const parcelValue = Math.round(Number(order.total) || 100000);
    const itemsSummary = (order.items || [])
      .map((i) => `${(i.product && i.product.name) || 'Len'} x${i.quantity || 1}`)
      .join(', ')
      .slice(0, 180);
    const giftSuffix = toAddr.bonusGiftProductName
      ? ` + Quà: ${toAddr.bonusGiftProductName}`
      : '';

    const createRes = await callGoshipApi('/api/v2/shipments', 'POST', {
      shipment: {
        rate: chosenRateId,
        payer: 1, // 1 = Shop trả phí ship cho Goship (vì phí ship đã cộng/freeship trong đơn)
        order_id: order.id,
        node_code: 'CHOXEMHANGKHONGTHU',
        note_code: 'CHOXEMHANGKHONGTHU',
        address_from: {
          name: warehouse.senderName,
          phone: warehouse.senderPhone,
          street: warehouse.fromStreet,
          city: fromLoc.cityCode,
          district: fromLoc.districtCode,
          ward: fromLoc.wardCode,
        },
        address_to: {
          name: toAddr.fullName || 'Khách hàng',
          phone: String(toAddr.phone || '').replace(/[^0-9]/g, ''),
          street: toAddr.detailAddress || `${toAddr.ward || ''}, ${toAddr.district || ''}`,
          city: toLoc.cityCode,
          district: toLoc.districtCode,
          ward: toLoc.wardCode,
        },
        parcel: {
          name: `${itemsSummary}${giftSuffix}`.slice(0, 200) || 'Đồ len thủ công Tiệm Cuộn Len',
          cod: codAmount,
          amount: parcelValue,
          weight: weightGrams,
          length: 15,
          width: 15,
          height: 10,
          metadata: 'Đồ len thủ công hộp quà, xin nhẹ tay không đè bẹp hộp. Cho đồng kiểm xem hàng.',
        },
      },
    });

    if (!createRes.ok) {
      return res.status(400).json({
        success: false,
        error: createRes.error || 'Tạo vận đơn trên Goship thất bại.',
      });
    }

    const rawCreated = createRes.raw || createRes.data || {};
    const goshipId = String(rawCreated.id || (createRes.data && createRes.data.id) || '').trim();
    const trackingNumber = String(
      rawCreated.tracking_number ||
        rawCreated.carrier_code ||
        (createRes.data && (createRes.data.tracking_number || createRes.data.carrier_code)) ||
        goshipId
    ).trim();
    const carrierRaw = String(
      rawCreated.carrier_short_name || rawCreated.carrier || 'SPX'
    ).toLowerCase();
    const carrierDisplay =
      carrierRaw.includes('shopee') || carrierRaw.includes('spx')
        ? 'SPX'
        : sanitizeTextServer(rawCreated.carrier || 'SPX', 40);

    const nowIso = new Date().toISOString();
    const updatedAddr = {
      ...toAddr,
      shippingCarrier: carrierDisplay,
      trackingCode: trackingNumber,
      goshipShipmentId: goshipId || undefined,
      goshipStatusText: 'Chờ Shipper SPX qua lấy hàng',
      shippedAt: nowIso,
      craftingStage: 'handed_to_spx',
      goshipHistory: [
        {
          status: 901,
          statusText: 'Đã tạo vận đơn SPX',
          description: `Tiệm đã đóng hộp xong & tạo vận đơn ${carrierDisplay} (${trackingNumber}) — Đang chờ bưu tá tới lấy hàng`,
          timestamp: nowIso,
        },
      ],
    };

    await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'Đang giao',
          shippingAddress: updatedAddr,
        }),
      }
    );

    await sendCustomerOrderLifecycleEmailServer(
      { ...order, status: 'Đang giao', shippingAddress: updatedAddr },
      'shipped'
    );

    return res.status(200).json({
      success: true,
      orderId: order.id,
      goshipShipmentId: goshipId,
      trackingCode: trackingNumber,
      shippingCarrier: carrierDisplay,
      shippingAddress: updatedAddr,
    });
  }

  return res.status(400).json({ success: false, error: 'Unsupported action' });
});
