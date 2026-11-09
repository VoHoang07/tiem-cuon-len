const crypto = require('crypto');

const rawEnvUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const rawEnvKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const isLegacyRestrictedProject =
  rawEnvUrl.includes('ljcweaeirwttqoygeoxd') ||
  rawEnvKey.includes('bGpjd2VhZWlyd3R0cW95Z2VveGQ');

const SUPABASE_URL =
  !rawEnvUrl || isLegacyRestrictedProject
    ? 'https://ajxvqewsqvfdpovkqqqw.supabase.co'
    : rawEnvUrl;
const SUPABASE_KEY =
  !rawEnvKey || isLegacyRestrictedProject
    ? 'sb_publishable_g3xVNQbOj0PyTj9NrCpDyw_6hmDGWab'
    : rawEnvKey;
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_SERVICE_KEY =
  !rawServiceKey || rawServiceKey.includes('bGpjd2VhZWlyd3R0cW95Z2VveGQ')
    ? SUPABASE_KEY
    : rawServiceKey;

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
  process.env.OWNER_NOTIFY_EMAIL || 'vohoang1327@gmail.com';
const SERVER_OWNER_NOTIFY_EMAILS = Array.from(
  new Set(
    [
      'vohoang1327@gmail.com',
      'khanhly30072007@gmail.com',
      ...(process.env.OWNER_NOTIFY_EMAIL || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ]
  )
);
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
  // 6 Curated Theme Combos + Package Variants
  combo_couple_zodiac_01: 139000,
  combo_couple_zodiac_01__pkg_couple_2zodiac: 139000,
  combo_couple_zodiac_01__pkg_couple_zodiac_flower: 129000,
  combo_bestie_cute_02: 85000,
  combo_bestie_cute_02__pkg_bestie_duck_chicken: 85000,
  combo_bestie_cute_02__pkg_bestie_foodie: 85000,
  combo_bestie_cute_02__pkg_bestie_any2: 85000,
  combo_sweet_bakery_03: 99000,
  combo_sweet_bakery_03__pkg_bakery_mini: 99000,
  combo_sweet_bakery_03__pkg_bakery_big: 289000,
  combo_muse_flower_plush_04: 145000,
  combo_muse_flower_plush_04__pkg_muse_delicate: 145000,
  combo_muse_flower_plush_04__pkg_muse_premium: 199000,
  combo_twinkle_universe_05: 379000,
  combo_twinkle_universe_05__pkg_twinkle_pair_mix: 379000,
  combo_twinkle_universe_05__pkg_twinkle_pair_regular: 469000,
  combo_winter_dalat_06: 219000,
  combo_winter_dalat_06__pkg_winter_earmuff: 219000,
  combo_winter_dalat_06__pkg_winter_bear_earmuff: 229000,
  combo_winter_dalat_06__pkg_winter_beanie: 259000,
  };

let cachedBlockedIps = new Set();
let cachedBlockedIpsAt = 0;

function syncBlockedIpInMemoryCache(ip, mode = 'add') {
  const cleanIp = String(ip || '').trim();
  if (!cleanIp || cleanIp.includes('/') || cleanIp.includes('*')) return;
  if (mode === 'remove') {
    cachedBlockedIps.delete(cleanIp);
  } else {
    cachedBlockedIps.add(cleanIp);
  }
  cachedBlockedIpsAt = Date.now();
}

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
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
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
      ADMIN_EMAILS.has(email) && (metaRole === 'admin' || email === 'vohoang1327@gmail.com' || email === 'khanhly30072007@gmail.com');

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

const EXACT_COMBO2_PRICE_MAP_SERVER = {
  35000: 65000,
  39000: 69000,
  45000: 79000,
  49000: 89000,
  55000: 99000,
  59000: 109000,
  65000: 119000,
  69000: 129000,
  75000: 139000,
  79000: 145000,
  85000: 155000,
  89000: 159000,
  95000: 175000,
  99000: 179000,
  115000: 209000,
  125000: 229000,
  129000: 239000,
  130000: 239000,
  135000: 249000,
  139000: 259000,
  145000: 269000,
  149000: 279000,
  155000: 289000,
  159000: 295000,
  165000: 309000,
  169000: 315000,
  170000: 319000,
  179000: 329000,
  189000: 349000,
  199000: 369000,
  229000: 429000,
  249000: 469000,
  255000: 479000,
  269000: 499000,
  270000: 499000,
  289000: 539000,
  345000: 649000,
  365000: 689000,
};

function calculateSmartCombo2PriceServer(unitPrice) {
  const cleanUnit = Math.max(1000, Math.round(Number(unitPrice) || 0));
  if (EXACT_COMBO2_PRICE_MAP_SERVER[cleanUnit]) {
    return EXACT_COMBO2_PRICE_MAP_SERVER[cleanUnit];
  }
  const twoTotal = cleanUnit * 2;
  if (twoTotal <= 40000) {
    return Math.max(1000, twoTotal - 3000);
  }
  const discounted = Math.round((twoTotal * 0.925) / 10000) * 10000 - 1000;
  if (discounted >= twoTotal) {
    return Math.max(1000, twoTotal - 9000);
  }
  return Math.max(1000, discounted);
}

/**
 * Resolves authoritative product prices from the Supabase `products` table + server catalog
 */
async function resolveAuthoritativeProductPrices(baseIds) {
  const priceMap = new Map();
  for (const [k, v] of Object.entries(STATIC_CATALOG_PRICES)) {
    priceMap.set(k, v);
    priceMap.set(`${k}__c_combo_2`, calculateSmartCombo2PriceServer(v));
  }

  const cleanIds = Array.from(
    new Set((baseIds || []).map((id) => String(id).split('__')[0]).filter(Boolean))
  );
  if (cleanIds.length === 0) return priceMap;

  try {
    const idFilter = cleanIds.map((id) => encodeURIComponent(id)).join(',');
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=in.(${idFilter})&select=id,price,name,tags&limit=200`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && row.id && Number(row.price) > 0) {
            const baseIdStr = String(row.id);
            const basePriceNum = Number(row.price);
            priceMap.set(baseIdStr, basePriceNum);
            priceMap.set(
              `${baseIdStr}__c_combo_2`,
              calculateSmartCombo2PriceServer(basePriceNum)
            );
            if (Array.isArray(row.tags)) {
              for (const tag of row.tags) {
                if (typeof tag === 'string' && tag.startsWith('__tcl_variants_v1__:')) {
                  try {
                    const parsedMeta = JSON.parse(tag.slice('__tcl_variants_v1__:'.length));
                    if (parsedMeta && Array.isArray(parsedMeta.colorOptions)) {
                      const firstVariantPrice = Number(
                        parsedMeta.colorOptions[0] && parsedMeta.colorOptions[0].price
                      );
                      if (firstVariantPrice > 0) {
                        priceMap.set(
                          `${baseIdStr}__c_combo_2`,
                          calculateSmartCombo2PriceServer(firstVariantPrice)
                        );
                      }
                      for (const co of parsedMeta.colorOptions) {
                        const vPrice = Number(co && co.price);
                        if (vPrice > 0) {
                          if (co.id) {
                            priceMap.set(`${baseIdStr}__${String(co.id)}`, vPrice);
                          }
                          if (co.name) {
                            priceMap.set(
                              `${baseIdStr}__name:${String(co.name).trim().toLowerCase()}`,
                              vPrice
                            );
                          }
                        }
                      }
                    }
                  } catch {
                    // ignore malformed variant metadata
                  }
                }
              }
            }
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
    hcmFee: 15000,
    provincialFee: 15000,
    freeshipThreshold: 299000,
  };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?id=eq.tcl_shipping_config_v3&select=detailAddress&limit=1`,
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
 * Server-Authoritative Grand Opening Promo Vouchers (Anti-Loss Protection):
 * Enforces strict minimum order subtotals on the Server so no client can fake a discount on small orders.
 */
const AUTHORITATIVE_PROMO_VOUCHERS = {
  CHAOBAN10K: { minOrderSubtotal: 99000, discountAmount: 10000 },
  KHAITRUONG20K: { minOrderSubtotal: 179000, discountAmount: 20000 },
  CUONLEN35K: { minOrderSubtotal: 299000, discountAmount: 35000 },
  VIP50K: { minOrderSubtotal: 429000, discountAmount: 50000 },
};

function resolveAuthoritativePromoDiscount(rawCode, authoritativeSubtotal) {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (!code) {
    return { promoCode: '', discountAmount: 0 };
  }
  const rule = AUTHORITATIVE_PROMO_VOUCHERS[code];
  if (!rule) {
    return { promoCode: '', discountAmount: 0 };
  }
  const sub = Number(authoritativeSubtotal) || 0;
  if (sub < rule.minOrderSubtotal) {
    return { promoCode: '', discountAmount: 0 };
  }
  return {
    promoCode: code,
    discountAmount: rule.discountAmount,
  };
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
      // Exempt SePay Webhook endpoint from IP blocklist so legitimate bank transfer webhooks are never blocked
      const isWebhookRoute = routeName === '/api/sepay-webhook';
      if (!isWebhookRoute) {
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
      if (addr.promoCode && Number(addr.discountAmount) > 0) {
      itemLines.push(
        `🎟️ Mã giảm giá (${addr.promoCode}): -${formatPrice(addr.discountAmount)}`
      );
      }
      itemLines.push(`🚚 Vận chuyển: ${shippingMethod} — ${formatPrice(shippingFee)}`);

    const orderDate = new Date(order.createdAt || Date.now()).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const baseTemplateParams = {
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
    };

    const results = await Promise.all(
      SERVER_OWNER_NOTIFY_EMAILS.map((recipientEmail) =>
        fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://www.tiemcuonlen.shop',
          },
          body: JSON.stringify({
            service_id: SERVER_EMAILJS_SERVICE_ID,
            template_id: SERVER_EMAILJS_TEMPLATE_ID,
            user_id: SERVER_EMAILJS_PUBLIC_KEY,
            template_params: {
              ...baseTemplateParams,
              email: recipientEmail,
            },
          }),
        })
          .then((r) => r.ok)
          .catch(() => false)
      )
    );
    return results.some(Boolean);
    } catch {
    return false;
    }
    }

    /**
    * Sends instant Live Chat notification to ALL Shop Owner emails (`vohoang1327@gmail.com` & `khanhly30072007@gmail.com`)
    * so both owners are notified immediately even when the website is completely closed.
    */
    async function sendChatNotificationServer(chatPayload) {
    if (!chatPayload || !chatPayload.text) return false;

    const customerName = sanitizeTextServer(
    chatPayload.customerName || 'Khách hàng',
    80
    );
    const customerEmail = sanitizeTextServer(chatPayload.customerEmail || '', 120);
    const messageText = sanitizeTextServer(chatPayload.text || '', 600);
    const productName = sanitizeTextServer(chatPayload.productName || '', 140);
    const conversationId = sanitizeTextServer(
    chatPayload.conversationId || 'conv',
    60
    );

    const chatDate = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    });

    let sentAny = false;

    // 1. Optional Telegram Bot instant push if configured in environment
    const tgToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const tgChatId = process.env.TELEGRAM_CHAT_ID || '';
    if (tgToken && tgChatId) {
    try {
      const tgText = [
        `💬 *TIN NHẮN MỚI TỪ KHÁCH HÀNG*`,
        `👤 Khách: ${customerName}${customerEmail ? ` (${customerEmail})` : ''}`,
        productName ? `🧶 Sản phẩm quan tâm: ${productName}` : null,
        `📝 Nội dung:\n"${messageText}"`,
        `⏰ Thời gian: ${chatDate}`,
        `👉 Mở web trả lời: https://www.tiemcuonlen.shop`,
      ]
        .filter(Boolean)
        .join('\n');

      const tgRes = await fetch(
        `https://api.telegram.org/bot${tgToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: tgText,
          }),
        }
      );
      if (tgRes.ok) sentAny = true;
    } catch {
      // continue to EmailJS
    }
    }

    // 2. EmailJS push notification to BOTH Shop Owner Gmails (`vohoang1327@gmail.com` & `khanhly30072007@gmail.com`)
    if (
    SERVER_EMAILJS_SERVICE_ID &&
    SERVER_EMAILJS_TEMPLATE_ID &&
    SERVER_EMAILJS_PUBLIC_KEY
    ) {
    try {
      const lines = [`💬 Nội dung khách nhắn:\n"${messageText}"`];
      if (productName) {
        lines.push(`🧶 Sản phẩm đính kèm: ${productName}`);
      }
      lines.push(`👉 Mở web trả lời ngay: https://www.tiemcuonlen.shop`);

      const shortConv = conversationId.replace(/^user_|^guest_/, '').slice(0, 8);
      const baseTemplateParams = {
        order_id: `CHAT-${shortConv.toUpperCase()}`,
        customer_name: `💬 ${customerName}`,
        customer_phone:
          customerEmail || 'Khách nhắn trực tiếp trên Web tiemcuonlen.shop',
        customer_address:
          'Bấm mở https://www.tiemcuonlen.shop để trả lời khách ngay',
        items_list: lines.join('\n\n'),
        total: 'Tin nhắn mới cần tư vấn',
        payment_method: 'Hộp thư Trực tuyến (Live Chat)',
        order_date: chatDate,
        subject: `💬 Tin nhắn mới từ ${customerName}: "${messageText.slice(0, 42)}"`,
      };

      const results = await Promise.all(
        SERVER_OWNER_NOTIFY_EMAILS.map((recipientEmail) =>
          fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: 'https://www.tiemcuonlen.shop',
            },
            body: JSON.stringify({
              service_id: SERVER_EMAILJS_SERVICE_ID,
              template_id: SERVER_EMAILJS_TEMPLATE_ID,
              user_id: SERVER_EMAILJS_PUBLIC_KEY,
              template_params: {
                ...baseTemplateParams,
                email: recipientEmail,
              },
            }),
          })
            .then((r) => r.ok)
            .catch(() => false)
        )
      );
      if (results.some(Boolean)) sentAny = true;
    } catch {
      // ignore
    }
    }

    return sentAny;
    }

    /**
    * Sends instant Email notification directly to the Customer's Gmail when Admin replies,
    * so the Customer receives a phone/desktop notification even after leaving `tiemcuonlen.shop`!
    */
    async function sendChatReplyToCustomerServer(replyPayload) {
    if (!replyPayload || !replyPayload.text || !replyPayload.customerEmail) {
    return false;
    }
    if (
    !SERVER_EMAILJS_SERVICE_ID ||
    !SERVER_EMAILJS_TEMPLATE_ID ||
    !SERVER_EMAILJS_PUBLIC_KEY
    ) {
    return false;
    }

    const rawEmail = sanitizeTextServer(replyPayload.customerEmail || '', 120)
    .trim()
    .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return false;
    }

    const customerName = sanitizeTextServer(
    replyPayload.customerName || 'Bạn',
    80
    );
    const replyText = sanitizeTextServer(replyPayload.text || '', 600);
    const productName = sanitizeTextServer(replyPayload.productName || '', 140);
    const conversationId = sanitizeTextServer(
    replyPayload.conversationId || 'conv',
    60
    );

    const chatDate = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    });

    try {
    const lines = [`💬 Tiệm Cuộn Len vừa trả lời bạn:\n"${replyText}"`];
    if (productName) {
      lines.push(`🧶 Mẫu sản phẩm: ${productName}`);
    }
    lines.push(
      `👉 Bấm vào đây để mở lại cuộc trò chuyện và xem chi tiết: https://www.tiemcuonlen.shop`
    );

    const shortConv = conversationId.replace(/^user_|^guest_/, '').slice(0, 8);
    const templateParams = {
      order_id: `TIEM-${shortConv.toUpperCase()}`,
      customer_name: `🧶 Tiệm Cuộn Len (Gửi ${customerName})`,
      customer_phone: 'Tư vấn trực tuyến tại tiemcuonlen.shop',
      customer_address:
        'Bấm mở https://www.tiemcuonlen.shop để xem phản hồi và nhắn tiếp',
      items_list: lines.join('\n\n'),
      total: 'Phản hồi từ Tiệm Cuộn Len',
      payment_method: 'Hộp thư Trực tuyến (Live Chat)',
      order_date: chatDate,
      subject: `🧶 Tiệm Cuộn Len vừa trả lời tin nhắn của bạn: "${replyText.slice(0, 40)}"`,
      email: rawEmail,
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
    SUPABASE_SERVICE_KEY,
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
    syncBlockedIpInMemoryCache,
    verifySupabaseUser,
    resolveAuthoritativeProductPrices,
    resolveAuthoritativeShippingConfig,
    resolveAuthoritativePromoDiscount,
    logServerAuditEvent,
    withGlobalErrorHandler,
    sendOrderNotificationServer,
    sendChatNotificationServer,
    sendChatReplyToCustomerServer,
    signBlockedIpRecord,
    verifyBlockedIpRecord,
    };
