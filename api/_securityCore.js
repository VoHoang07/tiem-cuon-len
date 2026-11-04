const crypto = require('crypto');

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ljcweaeirwttqoygeoxd.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqY3dlYWVpcnd0dHFveWdlb3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzA0MjUsImV4cCI6MjA5NTIwNjQyNX0.fa1AsIt3qcv24GvUz6Jzup7G_BUwvB4OKPzhQYYvOes';

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

  // 1. Check Origin if present
  if (origin) {
    const originAllowed =
      ALLOWED_ORIGINS.has(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:');
    if (!originAllowed) {
      return { valid: false, reason: `Untrusted Origin header: ${origin}` };
    }
  } else if (referer) {
    // 2. Fallback to Referer check
    const refAllowed =
      referer.startsWith('https://www.tiemcuonlen.shop') ||
      referer.startsWith('https://tiemcuonlen.shop') ||
      referer.includes('.vercel.app') ||
      referer.startsWith('http://localhost:');
    if (!refAllowed) {
      return { valid: false, reason: `Untrusted Referer header: ${referer}` };
    }
  } else if (host) {
    // 3. Fallback to Host check
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

  const cleanIds = Array.from(new Set((baseIds || []).map((id) => String(id).split('__')[0]).filter(Boolean)));
  if (cleanIds.length === 0) return priceMap;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,price,name`, {
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

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  ADMIN_EMAILS,
  STATIC_CATALOG_PRICES,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  applySecureCookiesAndHeaders,
  verifyCsrfRequest,
  verifySupabaseUser,
  resolveAuthoritativeProductPrices,
};
