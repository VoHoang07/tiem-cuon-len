const crypto = require('crypto');

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ljcweaeirwttqoygeoxd.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqY3dlYWVpcnd0dHFveWdlb3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzA0MjUsImV4cCI6MjA5NTIwNjQyNX0.fa1AsIt3qcv24GvUz6Jzup7G_BUwvB4OKPzhQYYvOes';

const AUDIT_LOG_PARTITION = '__TCL_SECURITY_AUDIT_LOG_V1__';
const BLOCKLIST_PARTITION = '__TCL_SECURITY_BLOCKLIST_V1__';
const SHOP_CONFIG_PARTITION = '__TCL_SHOP_CONFIG_V1__';
const HOLDER_USER_ID = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';

// Server-only EmailJS configuration (kept out of client bundle)
const SERVER_EMAILJS_SERVICE_ID =
  process.env.EMAILJS_SERVICE_ID ||
  process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID ||
  'service_fk9anb7';
const SERVER_EMAILJS_TEMPLATE_ID =
  process.env.EMAILJS_TEMPLATE_ID ||
  process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID ||
  'template_q41v0ct';
const SERVER_EMAILJS_PUBLIC_KEY =
  process.env.EMAILJS_PUBLIC_KEY ||
  process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY ||
  'kT2DQJicRXPdQjvb3';
const SERVER_OWNER_NOTIFY_EMAIL =
  process.env.OWNER_NOTIFY_EMAIL || 'khanhly30072007@gmail.com';
const BLOCKLIST_HMAC_SECRET =
  process.env.TCL_BLOCKLIST_HMAC_SECRET ||
  process.env.SEPAY_WEBHOOK_SECRET ||
  'tcl_srv_hmac_guard_9f4b2c8e1d7a6053_v1';

function signBlockedIpRecord(ip, createdAt) {
  return crypto
    .createHmac('sha256', BLOCKLIST_HMAC_SECRET)
    .update(`${String(ip).trim()}|${String(createdAt).trim()}`)
    .digest('hex');
}

function verifyBlockedIpRecord(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const ip = String(entry.ip || '').trim();
  const createdAt = String(entry.createdAt || '').trim();
  const sig = String(entry.sig || '').trim();
  if (!ip || !createdAt || !sig) return false;
  // Reject CIDR ranges or wildcard patterns to prevent blocking an entire regional subnet
  if (ip.includes('/') || ip.includes('*') || ip === '0.0.0.0' || ip === '::') {
    return false;
  }
  const expected = signBlockedIpRecord(ip, createdAt);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

const ADMIN_EMAILS = new Set([
  'vohoang1327@gmail.com',
  'khanhly30072007@gmail.com',
]);

const ALLOWED_ORIGINS = new Set([
  'https://www.tiemcuonlen.shop',
  'https://tiemcuonlen.shop',
  'http://localhost:8081',
  'http://localhost:19006',
]);

const ALLOWED_HOSTS = new Set([
  'www.tiemcuonlen.shop',
  'tiemcuonlen.shop',
  'localhost:8081',
  'localhost:19006',
]);

// Server-side authoritative baseline prices for catalog products
const STATIC_CATALOG_PRICES = {
  user_bunny_keychain_01: 85000,
  'cherry-1': 69000,
  'icecream-2': 79000,
  'keychain-capybara-4': 89000,
  'yarn-milk-cotton-1': 135000,
  'yarn-velvet-chunky-2': 95000,
  'yarn-rainbow-cake-3': 115000,
  'sunflower-3': 179000,
  'bouquet-4': 229000,
  'crochet-lily-valley-5': 199000,
  'bearbag-7': 249000,
  'bag-daisy-tote-2': 289000,
  'bag-ribbon-coquette-4': 269000,
  'dino-5': 129000,
  'doll-teddy-sweater-2': 165000,
  'doll-cat-fish-4': 159000,
  'mirror-6': 189000,
  'acc-daisy-headband-2': 75000,
  'acc-flower-coaster-3': 115000,
  vw_pot_rose_01: 125000,
  vw_pot_succulent_02: 89000,
  vw_flower_hydrangea_03: 135000,
  vw_flower_peony_04: 145000,
  vw_acc_butterfly_05: 59000,
  vw_acc_bracelet_06: 45000,
  vw_stem_pastel_07: 75000,
  vw_stem_glitter_08: 39000,
};

let cachedBlockedIps = new Set();
let cachedBlockedIpsAt = 0;

/**
 * Extracts client IP & geo telemetry from trusted Cloudflare / Vercel edge headers first
 * to prevent X-Forwarded-For IP spoofing attacks against regional users.
 */
function extractClientTelemetry(req) {
  const headers = (req && req.headers) || {};
  const vercelForwarded = String(headers['x-vercel-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const rawForwarded = String(headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const ip =
    String(headers['cf-connecting-ip'] || '').trim() ||
    vercelForwarded ||
    String(headers['x-real-ip'] || '').trim() ||
    rawForwarded ||
    'unknown';

  const country = String(
    headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || 'VN'
  ).trim();
  const cityRaw = String(headers['x-vercel-ip-city'] || '').trim();
  let city = cityRaw;
  try {
    if (cityRaw) city = decodeURIComponent(cityRaw);
  } catch {
    // ignore decode error
  }
  const region = String(headers['x-vercel-ip-country-region'] || '').trim();
  const asn = String(headers['x-vercel-ip-as-number'] || '').trim();
  const userAgent = String(headers['user-agent'] || 'unknown').slice(0, 300);
  const referer = String(headers['referer'] || headers['referrer'] || '').slice(0, 240);
  const origin = String(headers['origin'] || '').slice(0, 160);

  return {
    ip,
    country,
    city,
    region,
    asn,
    userAgent,
    referer,
    origin,
  };
}

/**
 * Strips all HTML/Script tags, dangerous protocols, and inline event handlers
 */
function sanitizeTextServer(input, maxLength = 200) {
  if (input === null || input === undefined) return '';
  let str = String(input);
  try {
    str = str.normalize('NFC');
  } catch {
    // ignore
  }
  return str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Anti-Mass-Assignment: picks ONLY explicitly declared keys from an untrusted object
 */
function stripUnknownFieldsServer(raw, allowedKeys) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out = {};
  for (const key of allowedKeys) {
    if (
      Object.prototype.hasOwnProperty.call(raw, key) &&
      key !== '__proto__' &&
      key !== 'constructor' &&
      key !== 'prototype'
    ) {
      out[key] = raw[key];
    }
  }
  return out;
}

/**
 * Sets secure cookies (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`) and CORS headers
 */
function applySecureCookiesAndHeaders(req, res) {
  const headers = (req && req.headers) || {};
  const origin = String(headers.origin || '').trim();

  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.tiemcuonlen.shop');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Apikey, X-Requested-With, X-TCL-CSRF-Token'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Parse existing cookies or issue a fresh CSRF + HttpOnly Session Guard cookie
  const rawCookie = String(headers.cookie || '');
  const hasSessionGuard = rawCookie.includes('tcl_session_guard=');
  if (!hasSessionGuard) {
    const token = crypto.randomBytes(24).toString('hex');
    res.setHeader('Set-Cookie', [
      `tcl_session_guard=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
      `tcl_csrf_token=${token}; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
    ]);
  }
}

/**
 * CSRF Validation for state-changing requests (POST, PUT, PATCH, DELETE)
 */
function verifyCsrfRequest(req, options = { allowWebhook: false }) {
  if (!req || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return { valid: true };
  }
  if (options.allowWebhook) {
    return { valid: true };
  }

  const headers = req.headers || {};
  const origin = String(headers.origin || '').trim();
  const referer = String(headers.referer || headers.referrer || '').trim();
  const host = String(headers.host || headers['x-forwarded-host'] || '').trim();

  if (origin) {
    const originAllowed =
      ALLOWED_ORIGINS.has(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:');
    if (!originAllowed) {
      return { valid: false, reason: `Untrusted Origin header: ${origin}` };
    }
  } else if (referer) {
    const refAllowed =
      referer.startsWith('https://www.tiemcuonlen.shop') ||
      referer.startsWith('https://tiemcuonlen.shop') ||
      referer.includes('.vercel.app') ||
      referer.startsWith('http://localhost:');
    if (!refAllowed) {
      return { valid: false, reason: `Untrusted Referer header: ${referer}` };
    }
  } else if (host) {
    const hostAllowed =
      ALLOWED_HOSTS.has(host) ||
      host.endsWith('.vercel.app') ||
      host.startsWith('localhost:');
    if (!hostAllowed) {
      return { valid: false, reason: `Untrusted Host header: ${host}` };
    }
  }

  return { valid: true };
}

/**
 * Checks if an IP address is on the server-side blocklist (`__TCL_SECURITY_BLOCKLIST_V1__`).
 * Only honors records signed with the Server HMAC key (`verifyBlockedIpRecord`) so even if
 * someone reverse-engineers client keys, they cannot inject fake regional IPs into the blocklist.
 */
async function isIpBlockedOnServer(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1') return false;
  const now = Date.now();
  if (now - cachedBlockedIpsAt < 15000 && cachedBlockedIps.size > 0) {
    return cachedBlockedIps.has(ip);
  }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${BLOCKLIST_PARTITION}&select=phone,detailAddress&limit=100`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      const nextSet = new Set();
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (!r || !r.detailAddress) continue;
          try {
            const parsed =
              typeof r.detailAddress === 'string'
                ? JSON.parse(r.detailAddress)
                : r.detailAddress;
            if (verifyBlockedIpRecord(parsed)) {
              nextSet.add(String(parsed.ip).trim());
            }
          } catch {
            // ignore malformed row
          }
        }
      }
      cachedBlockedIps = nextSet;
      cachedBlockedIpsAt = now;
      return nextSet.has(ip);
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Verifies the caller's Supabase JWT token on the server to prevent IDOR & role spoofing
 */
async function verifySupabaseUser(req) {
  const headers = (req && req.headers) || {};
  const authHeader = String(headers.authorization || headers.Authorization || '').trim();
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token === SUPABASE_KEY) {
    return null;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const userData = await res.json();
    if (!userData || !userData.id) return null;

    const email = String(userData.email || '').toLowerCase().trim();
    const metaRole = userData.user_metadata && userData.user_metadata.role;
    const isAdmin =
      ADMIN_EMAILS.has(email) && (metaRole === 'admin' || email === 'vohoang1327@gmail.com');

    return {
      id: String(userData.id),
      email,
      isAdmin,
      accessToken: token,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves authoritative product prices from the Supabase `products` table + server catalog
 */
async function resolveAuthoritativeProductPrices(baseIds) {
  const priceMap = new Map();
  for (const [k, v] of Object.entries(STATIC_CATALOG_PRICES)) {
    priceMap.set(k, v);
  }

  const cleanIds = Array.from(
    new Set((baseIds || []).map((id) => String(id).split('__')[0]).filter(Boolean))
  );
  if (cleanIds.length === 0) return priceMap;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,price,name&limit=500`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && row.id && Number(row.price) > 0) {
            priceMap.set(String(row.id), Number(row.price));
          }
        }
      }
    }
  } catch {
    // fallback to STATIC_CATALOG_PRICES
  }

  return priceMap;
}

/**
 * Resolves authoritative shop shipping configuration from `__TCL_SHOP_CONFIG_V1__`
 */
async function resolveAuthoritativeShippingConfig() {
  const defaults = {
    hcmFee: 20000,
    provincialFee: 30000,
    freeshipThreshold: 150000,
  };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?fullName=eq.${SHOP_CONFIG_PARTITION}&select=detailAddress&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && row.detailAddress) {
        const parsed =
          typeof row.detailAddress === 'string'
            ? JSON.parse(row.detailAddress)
            : row.detailAddress;
        if (parsed && typeof parsed === 'object') {
          return {
            hcmFee:
              typeof parsed.hcmFee === 'number' && parsed.hcmFee >= 0
                ? parsed.hcmFee
                : defaults.hcmFee,
            provincialFee:
              typeof parsed.provincialFee === 'number' && parsed.provincialFee >= 0
                ? parsed.provincialFee
                : defaults.provincialFee,
            freeshipThreshold:
              typeof parsed.freeshipThreshold === 'number' && parsed.freeshipThreshold >= 0
                ? parsed.freeshipThreshold
                : defaults.freeshipThreshold,
          };
        }
      }
    }
  } catch {
    // fallback to defaults
  }
  return defaults;
}

/**
 * Writes a server-side security or error event directly into `__TCL_SECURITY_AUDIT_LOG_V1__`
 */
async function logServerAuditEvent(req, payload = {}) {
  try {
    const telemetry = extractClientTelemetry(req);
    const nowIso = new Date().toISOString();
    const eventType = sanitizeTextServer(payload.eventType || 'SERVER_API_ERROR', 60);
    const severity = sanitizeTextServer(payload.severity || 'CRITICAL', 20);
    const path = sanitizeTextServer(
      payload.path || (req && req.url) || '/api/unknown',
      200
    );
    const method = sanitizeTextServer(
      payload.method || (req && req.method) || 'API',
      30
    );
    const userEmail = sanitizeTextServer(payload.userEmail || 'System/API', 120);
    const locationLabel =
      [telemetry.city, telemetry.region, telemetry.country].filter(Boolean).join(', ') ||
      'VN';

    const logRow = {
      id: `audit_srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: HOLDER_USER_ID,
      fullName: AUDIT_LOG_PARTITION,
      phone: telemetry.ip.slice(0, 45),
      city: eventType,
      district: nowIso,
      ward: severity,
      detailAddress: JSON.stringify({
        ip: telemetry.ip,
        location: locationLabel,
        asn: telemetry.asn || '',
        eventType,
        severity,
        path,
        method,
        userEmail,
        userId: payload.userId || null,
        userAgent: telemetry.userAgent,
        screenSize: 'Server-API',
        language: 'vi-VN',
        referer: telemetry.referer || 'Direct',
        details: payload.details || {},
        timestamp: nowIso,
      }),
      isDefault: false,
    };

    await fetch(`${SUPABASE_URL}/rest/v1/addresses`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(logRow),
    });
  } catch {
    // Never throw from audit logger
  }
}

/**
 * Global API Error Handler Wrapper:
 * - Catches any unexpected runtime, parsing, or database error
 * - Logs full diagnostic details (stack, error message, route, IP) to the Audit Logger
 * - Returns ONLY a generic safe error message to the Client (zero stack trace leak)
 */
function withGlobalErrorHandler(routeName, handlerFn) {
  return async function wrappedHandler(req, res) {
    applySecureCookiesAndHeaders(req, res);

    if (req && req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    try {
      // Check server-side IP blocklist before executing business logic
      const telemetry = extractClientTelemetry(req);
      const blocked = await isIpBlockedOnServer(telemetry.ip);
      if (blocked) {
        await logServerAuditEvent(req, {
          eventType: 'BLOCKED_IP_ATTEMPT',
          severity: 'CRITICAL',
          path: routeName,
          details: { blockedIp: telemetry.ip, reason: 'Blocked at API gateway' },
        });
        return res.status(403).json({
          success: false,
          error: 'Truy cập bị từ chối: Địa chỉ IP của bạn đã bị khóa bởi hệ thống bảo mật.',
        });
      }

      return await handlerFn(req, res);
    } catch (err) {
      const errorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      await logServerAuditEvent(req, {
        eventType: 'SERVER_API_ERROR',
        severity: 'CRITICAL',
        path: routeName,
        details: {
          errorId,
          errorName: err && err.name ? String(err.name) : 'Error',
          errorMessage: err && err.message ? String(err.message).slice(0, 300) : 'Unknown error',
          stackPreview:
            err && err.stack
              ? String(err.stack)
                  .split('\n')
                  .slice(0, 4)
                  .join(' | ')
                  .slice(0, 500)
              : undefined,
        },
      });

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
          errorId,
        });
      }
    }
  };
}

/**
 * Sends order notification email from the Server so EmailJS keys never leak to the Client bundle
 */
async function sendOrderNotificationServer(order) {
  if (!order || !order.id) return false;
  if (!SERVER_EMAILJS_SERVICE_ID || !SERVER_EMAILJS_TEMPLATE_ID || !SERVER_EMAILJS_PUBLIC_KEY) {
    return false;
  }

  try {
    const addr = order.shippingAddress || {};
    const shippingMethod = addr.shippingMethod || 'Giao Tiết Kiệm';
    const shippingFee = typeof addr.shippingFee === 'number' ? addr.shippingFee : 0;
    const formatPrice = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

    const itemLines = (order.items || []).map((ci, idx) => {
      const pName = (ci.product && ci.product.name) || 'Sản phẩm';
      const qty = Number(ci.quantity) || 1;
      const unitPrice = Number(ci.price || (ci.product && ci.product.price) || 0);
      return `${idx + 1}. ${pName} x${qty} — ${formatPrice(unitPrice * qty)}`;
    });
    itemLines.push(`🚚 Vận chuyển: ${shippingMethod} — ${formatPrice(shippingFee)}`);

    const orderDate = new Date(order.createdAt || Date.now()).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const templateParams = {
      order_id: String(order.id),
      customer_name: String(addr.fullName || 'Khách hàng'),
      customer_phone: String(addr.phone || ''),
      customer_address: [addr.detailAddress, addr.ward, addr.district, addr.city]
        .filter(Boolean)
        .join(', '),
      items_list: itemLines.join('\n'),
      total: formatPrice(order.total),
      payment_method: `${order.paymentMethod || ''} • ${shippingMethod}`,
      order_date: orderDate,
      subject: `🧶 Đơn hàng mới #${order.id} — ${addr.fullName || 'Khách hàng'}`,
      email: SERVER_OWNER_NOTIFY_EMAIL,
    };

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.tiemcuonlen.shop',
      },
      body: JSON.stringify({
        service_id: SERVER_EMAILJS_SERVICE_ID,
        template_id: SERVER_EMAILJS_TEMPLATE_ID,
        user_id: SERVER_EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  AUDIT_LOG_PARTITION,
  BLOCKLIST_PARTITION,
  HOLDER_USER_ID,
  ADMIN_EMAILS,
  STATIC_CATALOG_PRICES,
  extractClientTelemetry,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  applySecureCookiesAndHeaders,
  verifyCsrfRequest,
  isIpBlockedOnServer,
  verifySupabaseUser,
  resolveAuthoritativeProductPrices,
  resolveAuthoritativeShippingConfig,
  logServerAuditEvent,
  withGlobalErrorHandler,
  sendOrderNotificationServer,
  signBlockedIpRecord,
  verifyBlockedIpRecord,
};
