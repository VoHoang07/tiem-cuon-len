const crypto = require('crypto');

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/(?:rest|auth|storage|functions|realtime)\/v1$/i, '')
  .replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_SERVICE_KEY = rawServiceKey || SUPABASE_KEY;

/**
 * Builds Supabase server-side headers compatible with BOTH:
 * 1. Modern `sb_secret_...` / `sb_publishable_...` keys (Supabase API Gateway rejects non-JWT strings inside `Authorization: Bearer ...` on GoTrue `/auth/v1/*`, so `apikey` is used without a malformed Bearer header unless a real 3-part JWT is available).
 * 2. Classic 3-part `eyJ...` `service_role` JWTs (passed in both `apikey` and `Authorization: Bearer`).
 */
function buildSupabaseServiceHeaders(fallbackJwtToken = '', extraHeaders = {}) {
  const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
  const headers = {
    apikey: apiKey,
    ...extraHeaders,
  };
  const isServiceKeyJwt = apiKey.split('.').length === 3;
  if (isServiceKeyJwt) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (fallbackJwtToken && String(fallbackJwtToken).split('.').length === 3) {
    headers.Authorization = `Bearer ${fallbackJwtToken}`;
  }
  return headers;
}

const AUDIT_LOG_PARTITION = '__TCL_SECURITY_AUDIT_LOG_V1__';
const BLOCKLIST_PARTITION = '__TCL_SECURITY_BLOCKLIST_V1__';
const SHOP_CONFIG_PARTITION = '__TCL_SHOP_CONFIG_V1__';
const PERSONAL_VOUCHER_PARTITION = '__TCL_PERSONAL_VOUCHER_V1__';
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
  // 28 Active Bundled Catalog Products & All Individual Model Variant Prices
  user_1794237712564: 189000,
  user_1794237712564__c_1794237614898_1: 189000,
  user_1794237712564__c_1794237614898_2: 189000,
  user_1794237712564__c_1794237614898_3: 189000,
  user_1794237712564__c_1794237614898_4: 189000,
  user_1794233156945: 89000,
  user_1794233156945__c_1794231762946_1: 89000,
  user_1794233156945__c_1794232857632_2: 89000,
  user_1794233156945__c_1794232857632_4: 89000,
  user_1794233156945__c_1794232857632_5: 89000,
  user_1794233156945__c_1794232857632_6: 89000,
  user_1794212097527: 159000,
  user_1794212097527__c_1794211667754_1: 159000,
  user_1794212097527__c_1794211708211_2: 159000,
  user_1794212097527__c_1794211717825_3: 279000,
  user_1794212097527__c_1794211721657_4: 279000,
  user_1794212097527__c_1794211726067_5: 359000,
  user_1794212097527__c_1794211729899_6: 359000,
  user_1794156959442: 95000,
  user_1794156959442__c_1794156656125_1: 95000,
  user_1794156959442__c_1794156665809_2: 95000,
  user_1794156959442__c_1794156669391_3: 95000,
  user_1794156959442__c_1794156672485_4: 95000,
  user_1794156959442__c_1794156675613_5: 95000,
  user_1794155402893: 179000,
  user_1794155402893__c_1794154326039_2: 179000,
  user_1794155402893__c_1794154331551_3: 249000,
  user_1794155402893__c_1794154336495_4: 249000,
  user_1794155402893__c_1794154341457_5: 179000,
  user_1794155402893__c_1794154346182_6: 249000,
  user_1794155402893__c_1794154750715_6: 179000,
  user_1794152247063: 249000,
  user_1794152247063__c_1794151762917_1: 249000,
  user_1794152247063__c_1794151769355_2: 249000,
  user_1794152247063__c_1794151772555_3: 249000,
  user_1794152247063__c_1794151776664_4: 249000,
  user_1794152247063__c_1794151779569_5: 249000,
  user_1794152247063__c_1794152017278_6: 249000,
  user_1793987529864: 65000,
  user_1793987529864__c_1793987161557_1: 65000,
  user_1793987529864__c_1793987165201_2: 65000,
  user_1793987529864__c_1793987182174_3: 65000,
  user_1793987529864__c_1793987199983_4: 65000,
  user_1793987529864__c_1793987209371_5: 65000,
  user_1793987529864__c_1793987392353_6: 65000,
  user_1793985079054: 365000,
  user_1793985079054__c_1793984225582_1: 365000,
  user_1793985079054__c_1793984239521_2: 350000,
  user_1793985079054__c_1793984243388_3: 350000,
  user_1793985079054__c_1793984246706_4: 350000,
  user_1793985079054__c_1793984252897_5: 350000,
  user_1793985079054__c_1793984258973_6: 350000,
  user_1793985079054__c_1793984263755_7: 350000,
  user_1793981290544: 249000,
  user_1793981290544__c_1793980521212_1: 249000,
  user_1793981290544__c_1793980820399_2: 249000,
  user_1793981290544__c_1793980825202_3: 249000,
  user_1793976261276: 139000,
  user_1793976261276__c_1793976215781_1: 139000,
  user_1793958733621: 49000,
  user_1793958733621__c_1793958591942_1: 49000,
  user_1793958181855: 49000,
  user_1793958181855__c_1793958000336_1: 49000,
  user_1793956553782: 69000,
  user_1793956553782__c_1793956417108_1: 69000,
  user_1793956553782__c_1793956421634_2: 69000,
  user_1793955545289: 49000,
  user_1793955545289__c_1793954257159_1: 49000,
  user_1793955545289__c_1793955268124_2: 49000,
  user_1793955545289__c_1793955283824_3: 49000,
  user_1793955545289__c_1793955318111_4: 49000,
  user_1793955545289__c_1793955355143_5: 49000,
  user_1793955545289__c_1793955383931_6: 49000,
  user_1793955545289__c_1793955422149_7: 49000,
  user_1793955545289__c_1793955452644_8: 49000,
  user_1793955545289__c_1793955471835_9: 49000,
  user_1793906593712: 249000,
  user_1793906593712__c_1793906202767_1: 249000,
  user_1793906593712__c_1793906202767_2: 249000,
  user_1793906593712__c_1793906202767_3: 189000,
  user_1793905231278: 159000,
  user_1793905231278__c_1793904987933_2: 159000,
  user_1793905231278__c_1793904987933_3: 159000,
  user_1793885702524: 189000,
  user_1793885702524__c_1793885604415_2: 189000,
  user_1793885702524__c_1793885604415_3: 189000,
  user_1793885702524__c_1793885604415_4: 189000,
  user_1793884910153: 149000,
  user_1793884910153__c_1793884790378_1: 149000,
  user_1793884910153__c_1793884790378_2: 149000,
  user_1793884910153__c_1793884790378_3: 149000,
  user_1793817035699: 345000,
  user_1793817035699__c_1793816582953_1: 345000,
  user_1793817035699__c_1793816621139_2: 345000,
  user_1793817035699__c_1793816675157_3: 345000,
  user_1793817035699__c_1793816698913_4: 345000,
  user_1793817035699__c_1793816844678_5: 345000,
  user_1793817035699__c_1793816927315_6: 345000,
  user_1793815539213: 279000,
  user_1793815539213__c_1793815153681_1: 279000,
  user_1793815539213__c_1793815178234_2: 279000,
  user_1793815539213__c_1793815203209_3: 279000,
  user_1793815539213__c_1793815265543_4: 279000,
  user_1793811032427: 39000,
  user_1793811032427__c_1: 39000,
  user_1793811032427__c_2: 39000,
  user_1793809415860: 45000,
  user_1793809415860__c_1: 45000,
  user_1793809415860__c_1793810239811_2: 45000,
  user_1793806143788: 49000,
  user_1793806143788__c_2: 49000,
  user_1793806143788__c_1793811081128_3: 49000,
  user_1793804889048: 49000,
  user_1793804889048__c_1: 49000,
  user_1793804889048__c_2: 49000,
  user_1793721241087: 69000,
  user_1793721241087__c_1793721040375_1: 69000,
  user_1793721241087__c_1793721040375_2: 69000,
  user_1793721241087__c_1793721040375_3: 69000,
  user_1793721241087__c_1793721040375_4: 69000,
  user_1793721241087__c_1793721040375_5: 69000,
  user_1793721241087__c_1793721040375_6: 69000,
  user_1793721241087__c_1793721040375_7: 69000,
  user_1793721241087__c_1793721040375_8: 69000,
  user_1793721241087__c_1793721040375_9: 69000,
  user_1793721241087__c_1793721040375_10: 69000,
  user_1793721241087__c_1793721040375_11: 69000,
  user_1793721241087__c_1793721040375_12: 69000,
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
  combo_twinkle_universe_05: 395000,
  combo_twinkle_universe_05__pkg_twinkle_pair_mix: 395000,
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
        headers: buildSupabaseServiceHeaders(),
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
  279000: 519000,
  289000: 539000,
  345000: 649000,
  350000: 659000,
  359000: 669000,
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

  function calculateDynamicPairComboPriceServer(price1, price2) {
  const u1 = Math.max(1000, Math.round(Number(price1) || 0));
  const u2 = Math.max(1000, Math.round(Number(price2) || 0));
  const originalPairTotal = u1 + u2;
  if (u1 === u2) {
    return calculateSmartCombo2PriceServer(u1);
  }
  if (originalPairTotal <= 40000) {
    return Math.max(1000, originalPairTotal - 3000);
  }
  let comboPrice = Math.round((originalPairTotal * 0.925) / 10000) * 10000 - 1000;
  if (comboPrice >= originalPairTotal) {
    comboPrice = Math.max(1000, originalPairTotal - 9000);
  }
  const minSafeFloor = Math.round((originalPairTotal * 0.88) / 1000) * 1000;
  if (comboPrice < minSafeFloor) {
    comboPrice =
      minSafeFloor + 9000 < originalPairTotal ? minSafeFloor : originalPairTotal - 9000;
  }
  return Math.max(1000, comboPrice);
  }

  function resolveComboSlotUnitPriceServer(slotId, priceMap) {
  if (!slotId || typeof slotId !== 'string') return 0;
  const parts = slotId.split('__');
  const slotProdId = parts[0];
  const slotVarId = parts[1] || '';
  if (!slotProdId) return 0;
  if (slotVarId && slotVarId !== 'main') {
    const exact = priceMap.get(`${slotProdId}__${slotVarId}`);
    if (typeof exact === 'number' && exact > 0) return exact;
  }
  const base = priceMap.get(slotProdId);
  return typeof base === 'number' && base > 0 ? base : 0;
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
    // 1. Fast lightweight base price lookup (<50ms, never selects multi-MB `tags` in bulk)
    const baseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=in.(${idFilter})&select=id,price,name&limit=200`,
      {
        method: 'GET',
        headers: buildSupabaseServiceHeaders(),
      }
    );
    const baseRows = baseRes.ok ? await baseRes.json() : [];
    if (Array.isArray(baseRows)) {
      for (const row of baseRows) {
        if (row && row.id && Number(row.price) > 0) {
          const baseIdStr = String(row.id);
          const basePriceNum = Number(row.price);
          priceMap.set(baseIdStr, basePriceNum);
          priceMap.set(
            `${baseIdStr}__c_combo_2`,
            calculateSmartCombo2PriceServer(basePriceNum)
          );
        }
      }
    }

    // 2. Fetch variant tags & ADMIN_SYNC rescue overrides per single ID so large TOAST rows never trigger 57014 timeout
    const applyRowToPriceMap = (row) => {
      if (!row || !row.id || !(Number(row.price) > 0)) return;
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
    };

    for (const singleId of cleanIds) {
      try {
        const [prodTagRes, rescueRes] = await Promise.all([
          fetch(
            `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(
              singleId
            )}&select=id,price,tags&limit=1`,
            {
              method: 'GET',
              headers: buildSupabaseServiceHeaders(),
            }
          ),
          fetch(
            `${SUPABASE_URL}/rest/v1/addresses?id=eq.${encodeURIComponent(
              `tcl_rescue_${singleId}`
            )}&ward=eq.ADMIN_SYNC&select=id,detailAddress&limit=1`,
            {
              method: 'GET',
              headers: buildSupabaseServiceHeaders(),
            }
          ),
        ]);
        if (prodTagRes.ok) {
          const pRows = await prodTagRes.json();
          if (Array.isArray(pRows) && pRows[0]) {
            applyRowToPriceMap(pRows[0]);
          }
        }
        if (rescueRes.ok) {
          const rRows = await rescueRes.json();
          if (Array.isArray(rRows) && rRows[0] && rRows[0].detailAddress) {
            try {
              const parsed = JSON.parse(rRows[0].detailAddress);
              applyRowToPriceMap(parsed);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // continue
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
    freeshipEnabled: true,
    freeshipThreshold: 299000,
  };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?id=eq.tcl_shipping_config_v3&select=detailAddress&limit=1`,
      {
        headers: buildSupabaseServiceHeaders(),
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
            freeshipEnabled:
              typeof parsed.freeshipEnabled === 'boolean'
                ? parsed.freeshipEnabled
                : defaults.freeshipEnabled,
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
      headers: buildSupabaseServiceHeaders('', {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify(logRow),
    });
  } catch {
    // Never throw from audit logger
  }
}

/**
 * Server-Authoritative Profit-Protected Promo Vouchers (Direction 2 + Personal 1-to-1 Social Mission Vouchers):
 * - Public vouchers NEVER stack on top of discounted Combo items (`eligibleRetailSubtotal` only).
 * - `TIEMLEN10K`: Strictly for first-time customers only (0 prior non-cancelled orders by userId, email, or phone).
 * - `VIP20K`: Single-use per customer (cannot be reused across multiple orders).
 * - Personal Mission Vouchers (`VD25-XXXXXX` for Video Unboxing + Web Link, `FB15-XXXXXX` for FB Follow + Public Share):
 *   HMAC-signed on Server, bound 1-to-1 to the exact recipient (`boundUserId` / `boundEmail`), and burned (`status: 'USED'`) immediately upon order creation.
 */
const AUTHORITATIVE_PROMO_VOUCHERS = {
  TIEMLEN10K: {
    minRetailSubtotal: 159000,
    discountAmount: 10000,
    newCustomerOnly: true,
    singleUsePerUser: true,
  },
  VIP20K: {
    minRetailSubtotal: 399000,
    discountAmount: 20000,
    newCustomerOnly: false,
    singleUsePerUser: true,
  },
};

const PERSONAL_MISSION_SPECS = {
  video_unbox_25k: {
    prefix: 'VD25',
    discountAmount: 25000,
    minRetailSubtotal: 159000,
    title: 'Gói Quà 60.000₫: Giảm 25k + Tặng 1 SP 35k tự chọn của Tiệm',
  },
  fb_follow_share_15k: {
    prefix: 'FB15',
    discountAmount: 15000,
    minRetailSubtotal: 119000,
    title: 'Follow Fanpage FB + Chia sẻ bài công khai (-15.000₫)',
  },
};

function signPersonalVoucherRecord(payload) {
  const canonical = [
    String(payload.code || '').trim().toUpperCase(),
    String(payload.missionType || '').trim(),
    String(payload.discountAmount || 0),
    String(payload.minRetailSubtotal || 0),
    String(payload.boundUserId || '').trim(),
    String(payload.boundEmail || '').trim().toLowerCase(),
    String(payload.createdAt || '').trim(),
  ].join('|');
  return crypto
    .createHmac('sha256', BLOCKLIST_HMAC_SECRET)
    .update(canonical)
    .digest('hex');
}

function verifyPersonalVoucherRecord(record) {
  if (!record || typeof record !== 'object' || !record.sig) return false;
  const expected = signPersonalVoucherRecord(record);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(record.sig)),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

async function fetchUserPastValidOrders(userId, email, phone) {
  const matchedOrders = new Map();
  const headers = buildSupabaseServiceHeaders();

  try {
    if (userId) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?userId=eq.${encodeURIComponent(
          userId
        )}&select=id,status,shippingAddress&limit=50`,
        { headers }
      );
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (
              row &&
              row.id &&
              row.status !== 'Đã hủy' &&
              row.status !== 'pending_payment'
            ) {
              matchedOrders.set(row.id, row);
            }
          }
        }
      }
    }

    // Also inspect recent orders for matching phone/email so creating a 2nd guest account cannot bypass new-customer check
    if (phone || email) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=id,userId,status,shippingAddress&order=createdAt.desc&limit=120`,
        { headers }
      );
      if (r2.ok) {
        const rows2 = await r2.json();
        const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (Array.isArray(rows2)) {
          for (const row of rows2) {
            if (
              !row ||
              !row.id ||
              row.status === 'Đã hủy' ||
              row.status === 'pending_payment'
            ) {
              continue;
            }
            const addr = row.shippingAddress || {};
            const rowPhone = String(addr.phone || '').replace(/[^0-9]/g, '');
            const rowEmail = String(addr.email || '').trim().toLowerCase();
            if (
              (cleanPhone && rowPhone && cleanPhone === rowPhone) ||
              (cleanEmail && rowEmail && cleanEmail === rowEmail)
            ) {
              matchedOrders.set(row.id, row);
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return Array.from(matchedOrders.values());
}

async function issuePersonalMissionVoucherServer({
  missionType,
  targetUserId,
  targetEmail,
  targetCustomerName,
  targetOrderId,
  issuedByEmail,
  adminAccessToken,
}) {
  const spec = PERSONAL_MISSION_SPECS[missionType];
  if (!spec) {
    return { ok: false, error: 'Loại nhiệm vụ thưởng không hợp lệ.' };
  }
  const cleanUid = sanitizeTextServer(targetUserId || '', 80);
  const cleanEmail = sanitizeTextServer(targetEmail || '', 120).toLowerCase();
  if (!cleanUid && !cleanEmail) {
    return {
      ok: false,
      error: 'Cần có Tài khoản hoặc Gmail của khách hàng để khóa mã riêng 1-1.',
    };
  }

  const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `${spec.prefix}-${randSuffix}`;
  const nowIso = new Date().toISOString();

  const record = {
    code,
    missionType,
    title: spec.title,
    discountAmount: spec.discountAmount,
    minRetailSubtotal: spec.minRetailSubtotal,
    boundUserId: cleanUid,
    boundEmail: cleanEmail,
    customerName: sanitizeTextServer(targetCustomerName || 'Khách hàng', 80),
    sourceOrderId: sanitizeTextServer(targetOrderId || '', 80),
    issuedBy: sanitizeTextServer(issuedByEmail || 'Admin', 120),
    status: 'ACTIVE',
    createdAt: nowIso,
  };
  record.sig = signPersonalVoucherRecord(record);

  const row = {
    id: `pv_${code}`,
    userId: HOLDER_USER_ID,
    fullName: PERSONAL_VOUCHER_PARTITION,
    phone: cleanUid || cleanEmail,
    city: code,
    district: nowIso,
    ward: 'ACTIVE',
    detailAddress: JSON.stringify(record),
    isDefault: false,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/addresses?on_conflict=id`, {
    method: 'POST',
    headers: buildSupabaseServiceHeaders(adminAccessToken, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    return { ok: false, error: 'Không thể lưu mã cá nhân vào hệ thống.' };
  }
  return { ok: true, voucher: record };
}

async function markPersonalVoucherUsedServer(code, usedByOrderId, authToken) {
  const cleanCode = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (!cleanCode.startsWith('VD25-') && !cleanCode.startsWith('FB15-')) return;

  try {
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?id=eq.${encodeURIComponent(
        `pv_${cleanCode}`
      )}&fullName=eq.${PERSONAL_VOUCHER_PARTITION}&select=id,detailAddress&limit=1`,
      {
        headers: buildSupabaseServiceHeaders(),
      }
    );
    const rows = getRes.ok ? await getRes.json() : [];
    const existing = Array.isArray(rows) ? rows[0] : null;
    if (!existing || !existing.detailAddress) return;
    const parsed =
      typeof existing.detailAddress === 'string'
        ? JSON.parse(existing.detailAddress)
        : existing.detailAddress;

    const updatedRecord = {
      ...parsed,
      status: 'USED',
      usedOrderId: usedByOrderId,
      usedAt: new Date().toISOString(),
    };

    await fetch(
      `${SUPABASE_URL}/rest/v1/addresses?id=eq.${encodeURIComponent(
        `pv_${cleanCode}`
      )}`,
      {
        method: 'PATCH',
        headers: buildSupabaseServiceHeaders(authToken, {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          ward: 'USED',
          detailAddress: JSON.stringify(updatedRecord),
        }),
      }
    );
  } catch {
    // ignore
  }
}

async function resolveAuthoritativePromoDiscount(
  rawCode,
  eligibleRetailSubtotal,
  actorContext = {}
) {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (!code) {
    return { promoCode: '', discountAmount: 0 };
  }

  const retailSub = Math.max(0, Number(eligibleRetailSubtotal) || 0);
  if (retailSub <= 0) {
    return {
      promoCode: '',
      discountAmount: 0,
      error:
        'Mã giảm giá chỉ áp dụng cho các sản phẩm mua lẻ nguyên giá (không áp chồng lên gói Combo đã giảm giá sẵn).',
    };
  }

  const userId = String(actorContext.userId || '').trim();
  const email = String(actorContext.email || '').trim().toLowerCase();
  const phone = String(actorContext.phone || '').trim();

  // 1. Check Personal 1-to-1 Mission Vouchers (`VD25-XXXXXX` / `FB15-XXXXXX`)
  if (code.startsWith('VD25-') || code.startsWith('FB15-')) {
    try {
      const pvRes = await fetch(
        `${SUPABASE_URL}/rest/v1/addresses?id=eq.${encodeURIComponent(
          `pv_${code}`
        )}&fullName=eq.${PERSONAL_VOUCHER_PARTITION}&select=id,ward,detailAddress&limit=1`,
        {
          headers: buildSupabaseServiceHeaders(),
        }
      );
      const pvRows = pvRes.ok ? await pvRes.json() : [];
      const row = Array.isArray(pvRows) ? pvRows[0] : null;
      if (!row || !row.detailAddress) {
        return {
          promoCode: '',
          discountAmount: 0,
          error: `Mã thưởng "${code}" không tồn tại hoặc không hợp lệ.`,
        };
      }
      const parsed =
        typeof row.detailAddress === 'string'
          ? JSON.parse(row.detailAddress)
          : row.detailAddress;

      if (!verifyPersonalVoucherRecord(parsed)) {
        return {
          promoCode: '',
          discountAmount: 0,
          error: 'Chữ ký bảo mật của mã thưởng không hợp lệ.',
        };
      }

      if (row.ward === 'USED' || parsed.status === 'USED') {
        return {
          promoCode: '',
          discountAmount: 0,
          error: `Mã "${code}" đã được sử dụng ở đơn trước và không thể dùng lại lần 2.`,
        };
      }

      // Strict 1-to-1 Account Binding Check
      const boundUid = String(parsed.boundUserId || '').trim();
      const boundEmail = String(parsed.boundEmail || '').trim().toLowerCase();
      const uidMatched = boundUid && userId && boundUid === userId;
      const emailMatched = boundEmail && email && boundEmail === email;
      if ((boundUid || boundEmail) && !uidMatched && !emailMatched) {
        return {
          promoCode: '',
          discountAmount: 0,
          error:
            'Mã thưởng này được cấp độc quyền cho tài khoản khác — tài khoản của bạn không thể sử dụng.',
        };
      }

      const minReq = Number(parsed.minRetailSubtotal) || 0;
      if (retailSub < minReq) {
        return {
          promoCode: '',
          discountAmount: 0,
          error: `Mã ${code} áp dụng cho sản phẩm mua lẻ từ ${minReq.toLocaleString(
            'vi-VN'
          )}₫ (không tính món Combo).`,
        };
      }

      return {
        promoCode: code,
        discountAmount: Number(parsed.discountAmount) || 0,
        isPersonalVoucher: true,
        title: parsed.title,
      };
    } catch {
      return {
        promoCode: '',
        discountAmount: 0,
        error: 'Không thể xác thực mã thưởng lúc này. Vui lòng thử lại.',
      };
    }
  }

  // 2. Check Public Store Vouchers (`TIEMLEN10K`, `VIP20K`)
  const rule = AUTHORITATIVE_PROMO_VOUCHERS[code];
  if (!rule) {
    return {
      promoCode: '',
      discountAmount: 0,
      error: `Mã "${code}" không tồn tại hoặc đã hết hạn.`,
    };
  }

  if (retailSub < rule.minRetailSubtotal) {
    return {
      promoCode: '',
      discountAmount: 0,
      error: `Mã ${code} chỉ áp dụng khi tổng sản phẩm mua lẻ đạt từ ${rule.minRetailSubtotal.toLocaleString(
        'vi-VN'
      )}₫ (không tính các gói Combo đã giảm giá).`,
    };
  }

  const pastOrders = await fetchUserPastValidOrders(userId, email, phone);
  if (rule.newCustomerOnly && pastOrders.length > 0) {
    return {
      promoCode: '',
      discountAmount: 0,
      error: `Mã ${code} chỉ dành riêng cho đơn hàng đầu tiên của khách hàng mới.`,
    };
  }

  if (rule.singleUsePerUser) {
    const alreadyUsed = pastOrders.some(
      (ord) =>
        String((ord.shippingAddress && ord.shippingAddress.promoCode) || '')
          .trim()
          .toUpperCase() === code
    );
    if (alreadyUsed) {
      return {
        promoCode: '',
        discountAmount: 0,
        error: `Bạn đã sử dụng mã ${code} ở đơn hàng trước rồi (mỗi khách chỉ dùng 1 lần).`,
      };
    }
  }

  return {
    promoCode: code,
    discountAmount: rule.discountAmount,
    isPersonalVoucher: false,
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

const notifiedOrderIdsCache = new Map();

/**
 * Sends order notification email from the Server so EmailJS keys never leak to the Client bundle.
 * Strictly deduplicated (1 single EmailJS API call per order) so the owner never receives duplicate emails.
 */
async function sendOrderNotificationServer(order) {
  if (!order || !order.id) return false;
  if (!SERVER_EMAILJS_SERVICE_ID || !SERVER_EMAILJS_TEMPLATE_ID || !SERVER_EMAILJS_PUBLIC_KEY) {
    return false;
  }

  const orderKey = String(order.id).trim();
  const prevSentAt = notifiedOrderIdsCache.get(orderKey);
  if (prevSentAt && Date.now() - prevSentAt < 10 * 60 * 1000) {
    return true;
  }
  notifiedOrderIdsCache.set(orderKey, Date.now());

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
    if (addr.bonusGiftProductName) {
      itemLines.push(
        `🎀 QUÀ TẶNG KÈM CẦN GÓI CHUNG (Mã ${addr.promoCode || 'VD25'}): +01 ${addr.bonusGiftProductName} — Miễn phí 0đ`
      );
    }
    itemLines.push(`🚚 Vận chuyển: ${shippingMethod} — ${formatPrice(shippingFee)}`);
    if (addr.note) {
      itemLines.push(`💌 Ghi chú / Thiệp: ${addr.note}`);
    }
    const isVerifiedAcc = Boolean(addr.isVerifiedAccount || addr.email);
    itemLines.push(
      isVerifiedAcc
        ? `🛡️ Xác thực chống Scam: ✅ Acc Thật Đã Xác Thực (${addr.customerAuthProvider || 'Google / Gmail'}: ${addr.email || 'Chính chủ'})`
        : `🛡️ Xác thực chống Scam: ⚠️ Khách chưa liên kết Google/FB (Nên gọi xác nhận SĐT)`
    );

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
      customer_phone: String(
        addr.email ? `${addr.phone || ''} • ${addr.email}` : addr.phone || ''
      ),
      customer_address: [addr.detailAddress, addr.ward, addr.district, addr.city]
        .filter(Boolean)
        .join(', '),
      items_list: itemLines.join('\n'),
      total: formatPrice(order.total),
      payment_method: `${order.paymentMethod || ''} • ${shippingMethod}`,
      order_date: orderDate,
      subject: `🧶 Đơn hàng mới #${order.id} — ${addr.fullName || 'Khách hàng'}`,
      email: SERVER_OWNER_NOTIFY_EMAILS.join(', '),
    };

    // Single EmailJS dispatch per order (prevents duplicate emails when EmailJS template has hardcoded To/BCC)
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
        template_params: baseTemplateParams,
      }),
    });

    return res.ok;
  } catch {
    notifiedOrderIdsCache.delete(orderKey);
    return false;
  }
}

    /**
     * Sends automated lifecycle emails to the Customer when:
     * - `eventType === 'shipped'`: Admin marks order as 'Đang giao' or attaches a Tracking Code
     * - `eventType === 'completed'`: Admin marks order as 'Hoàn thành' (includes TRIAN15K gift voucher)
     */
    async function sendCustomerOrderLifecycleEmailServer(order, eventType) {
      if (!order || !order.id) return false;
      if (
        !SERVER_EMAILJS_SERVICE_ID ||
        !SERVER_EMAILJS_TEMPLATE_ID ||
        !SERVER_EMAILJS_PUBLIC_KEY
      ) {
        return false;
      }

      const addr = order.shippingAddress || {};
      const candidateCustEmail = String(addr.email || order.customerEmail || '')
        .trim()
        .toLowerCase();
      const isRealCustomerEmail =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateCustEmail) &&
        !candidateCustEmail.endsWith('@guest.tiemcuonlen.vn') &&
        !candidateCustEmail.endsWith('@phone.tiemcuonlen.vn') &&
        !SERVER_OWNER_NOTIFY_EMAILS.includes(candidateCustEmail);

      if (!isRealCustomerEmail) return false;

      try {
        const formatPrice = (n) =>
          `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
        const nowStr = new Date().toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        const itemNames = (order.items || [])
          .map(
            (ci) =>
              `${(ci.product && ci.product.name) || 'Sản phẩm'} (x${
                Number(ci.quantity) || 1
              })`
          )
          .join(', ');

        if (eventType === 'shipped') {
          const carrier = addr.shippingCarrier || 'Đơn vị vận chuyển';
          const tracking = addr.trackingCode || 'Đang cập nhật';
          const lines = [
            `🚚 Tin vui! Kiện hàng thủ công #${order.id} của ${
              addr.fullName || 'bạn'
            } đã được Tiệm Cuộn Len đóng gói cẩn thận và bàn giao cho bưu tá!`,
            `🏷️ Đơn vị vận chuyển: ${carrier}`,
            `🔢 Mã vận đơn: ${tracking}`,
            `🧶 Sản phẩm: ${itemNames}`,
            `🛡️ Lưu ý: Bạn được quyền Mở Hộp Kiểm Tra Hàng (Đồng kiểm 100%) trước khi nhận nhé!`,
            `👉 Tra cứu hành trình đơn hàng tại: https://www.tiemcuonlen.shop/orders/${order.id}`,
          ];

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
              template_params: {
                order_id: String(order.id),
                customer_name: String(addr.fullName || 'Khách hàng'),
                customer_phone: String(addr.phone || ''),
                customer_address: [
                  addr.detailAddress,
                  addr.ward,
                  addr.district,
                  addr.city,
                ]
                  .filter(Boolean)
                  .join(', '),
                items_list: lines.join('\n\n'),
                total: formatPrice(order.total),
                payment_method: `${carrier} • Mã vận đơn: ${tracking}`,
                order_date: nowStr,
                subject: `🚚 Đơn hàng #${order.id} đang giao đến bạn! (Mã vận đơn: ${tracking})`,
                email: candidateCustEmail,
              },
            }),
          });
          return res.ok;
        }

        if (eventType === 'completed') {
          const lines = [
            `💝 Cảm ơn ${
              addr.fullName || 'bạn'
            } đã tin tưởng và đón nhận sản phẩm thủ công từ Tiệm Cuộn Len!`,
            `🌟 Mời bạn ghé trang chi tiết đơn hàng để đánh giá 5 sao và tham gia 2 mục nhận Voucher độc quyền cho lần mua tiếp theo:`,
            `🎬 Mục 1 — Nhận Gói Quà 60.000₫ (Giảm 25.000₫ + Tặng kèm 01 sản phẩm 35.000₫ tự chọn của Tiệm): Quay video khui hàng đăng Story/Bài viết lên Facebook, Instagram hoặc TikTok kèm tên & link web tiemcuonlen.shop`,
            `👍 Mục 2 — Tặng mã riêng -15.000₫: Follow Fanpage Facebook của Tiệm & chia sẻ bài viết ở chế độ công khai`,
            `👉 Gửi đánh giá & ảnh màn hình nhận mã riêng tại: https://www.tiemcuonlen.shop/orders/${order.id}`,
          ];

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
              template_params: {
                order_id: String(order.id),
                customer_name: String(addr.fullName || 'Khách hàng'),
                customer_phone: String(addr.phone || ''),
                customer_address: 'Đơn hàng đã giao thành công',
                items_list: lines.join('\n\n'),
                total: '🎁 Cơ hội nhận Voucher 25k & 15k',
                payment_method: 'Hoàn thành đơn hàng',
                order_date: nowStr,
                subject: `💝 Cảm ơn bạn! Đánh giá đơn #${order.id} để nhận Voucher 25.000₫ từ Tiệm Cuộn Len`,
                email: candidateCustEmail,
              },
            }),
          });
          return res.ok;
        }

        return false;
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
          template_params: {
            ...baseTemplateParams,
            email: SERVER_OWNER_NOTIFY_EMAILS.join(', '),
          },
        }),
      });
      if (res.ok) sentAny = true;
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

const STATIC_OG_CATALOG = {"user_1794237712564":{"n":"Charm Thỏ Tang Tang ( Mix màu tuỳ ý )","p":189000,"i":"/catalog-media/user_1794237712564_cover.webp","d":"Charm Thỏ Tang Tang ( Mix màu tuỳ ý ) — Mẫu móc khoá đan móc thủ công nhỏ gọn, form đứng chắc chắn và giữ dáng tốt khi sử dụng lâu dài.","v":{"c_1794237614898_1":{"n":"Thỏ tang tang hồng phấn","p":189000,"i":"/catalog-media/user_1794237712564_c_1794237614898_1.webp"},"c_1794237614898_2":{"n":"Thỏ tang tang xanh dương baby","p":189000,"i":"/catalog-media/user_1794237712564_c_1794237614898_2.webp"},"c_1794237614898_3":{"n":"Thỏ tang tang xanh ngọc","p":189000,"i":"/catalog-media/user_1794237712564_c_1794237614898_3.webp"},"c_1794237614898_4":{"n":"Thỏ tang tang nâu","p":189000,"i":"/catalog-media/user_1794237712564_c_1794237614898_4.webp"}}},"user_1794233156945":{"n":"Charm Treo Túi Thỏ Múa Lân","p":89000,"i":"/catalog-media/user_1794233156945_cover.webp","d":"Mẫu Dây Treo Thỏ Đội Mũ Lân đan thủ công từ chất liệu len nhung gấu và len xù xiaoke — món phụ kiện và quà tặng may mắn, dễ thương.","v":{"c_1794231762946_1":{"n":"Thỏ Lân Đỏ","p":89000,"i":"/catalog-media/user_1794233156945_c_1794231762946_1.webp"},"c_1794232857632_2":{"n":"Thỏ Lân Vàng","p":89000,"i":"/catalog-media/user_1794233156945_c_1794232857632_2.webp"},"c_1794232857632_4":{"n":"Thỏ Lân Hồng","p":89000,"i":"/catalog-media/user_1794233156945_c_1794232857632_4.webp"},"c_1794232857632_5":{"n":"Thỏ Lân xanh dương","p":89000,"i":"/catalog-media/user_1794233156945_c_1794232857632_5.webp"},"c_1794232857632_6":{"n":"Thỏ Lân Xanh Lá","p":89000,"i":"/catalog-media/user_1794233156945_c_1794232857632_6.webp"}}},"user_1794212097527":{"n":"Bó Hoa Hồng Bông Len Nhung Đũa","p":159000,"i":"/catalog-media/user_1794212097527_cover.webp","d":"Bó hoa len nhung đũa thủ công có đủ Size và bảng màu xinh xắn, tặng kèm hộp quà và thiệp viết tay.","v":{"c_1794211667754_1":{"n":"Size 7-9 bông","p":159000,"i":"/catalog-media/user_1794212097527_c_1794211667754_1.webp"},"c_1794211708211_2":{"n":"Size 7-9 bông","p":159000,"i":"/catalog-media/user_1794212097527_c_1794211708211_2.webp"},"c_1794211717825_3":{"n":"Size 18-20 bông","p":279000,"i":"/catalog-media/user_1794212097527_c_1794211717825_3.webp"},"c_1794211721657_4":{"n":"Size 18-20 bông","p":279000,"i":"/catalog-media/user_1794212097527_c_1794211721657_4.webp"},"c_1794211726067_5":{"n":"size 25 Bông","p":359000,"i":"/catalog-media/user_1794212097527_c_1794211726067_5.webp"},"c_1794211729899_6":{"n":"Size 25 bông","p":359000,"i":"/catalog-media/user_1794212097527_c_1794211729899_6.webp"}}},"user_1794156959442":{"n":"Móc Khoá Thú Bông","p":95000,"i":"/catalog-media/user_1794156959442_cover.webp","d":"Bộ sưu tập móc khóa thú bông đan móc thủ công 100% từ chất liệu len nhung gấu dày dặn, mềm mịn và êm tay.","v":{"c_1794156656125_1":{"n":"Gấuuu Dâuu","p":95000,"i":"/catalog-media/user_1794156959442_c_1794156656125_1.webp"},"c_1794156665809_2":{"n":"Gấuuu Nâuu","p":95000,"i":"/catalog-media/user_1794156959442_c_1794156665809_2.webp"},"c_1794156669391_3":{"n":"Heoo Hồngg","p":95000,"i":"/catalog-media/user_1794156959442_c_1794156669391_3.webp"},"c_1794156672485_4":{"n":"Hổ Vàngg","p":95000,"i":"/catalog-media/user_1794156959442_c_1794156672485_4.webp"},"c_1794156675613_5":{"n":"Mèoo Camm","p":95000,"i":"/catalog-media/user_1794156959442_c_1794156675613_5.webp"}}},"user_1794155402893":{"n":"Móc Khoá Twinkle Chủ để Noel","p":179000,"i":"/catalog-media/user_1794155402893_cover.webp","d":"Móc Khoá Twinkle Chủ đề Noel — Mẫu móc khoá đan móc thủ công từ len nhung gấu và xù xiaoke cao cấp.","v":{"c_1794154326039_2":{"n":"Twinkle Cây Thông (1)","p":179000,"i":"/catalog-media/user_1794155402893_c_1794154326039_2.webp"},"c_1794154331551_3":{"n":"Twinkle Cây Thông (2)","p":249000,"i":"/catalog-media/user_1794155402893_c_1794154331551_3.webp"},"c_1794154336495_4":{"n":"Twinkle Cánh cụt","p":249000,"i":"/catalog-media/user_1794155402893_c_1794154336495_4.webp"},"c_1794154341457_5":{"n":"Twinkle Người Tuyết","p":179000,"i":"/catalog-media/user_1794155402893_c_1794154341457_5.webp"},"c_1794154346182_6":{"n":"Twinkle ông già noel","p":249000,"i":"/catalog-media/user_1794155402893_c_1794154346182_6.webp"},"c_1794154750715_6":{"n":"Twinkle Quả Châu Đỏ","p":179000,"i":"/catalog-media/user_1794155402893_c_1794154750715_6.webp"}}},"user_1794152247063":{"n":"Móc Khoá Twinkle Twinkle","p":249000,"i":"/catalog-media/user_1794152247063_cover.webp","d":"Móc Khoá Twinkle Twinkle — Mẫu móc khoá đan móc thủ công nhỏ gọn, form đứng chắc chắn từ len nhung gấu & xù Xiaoke.","v":{"c_1794151762917_1":{"n":"Twinkle Buồn Ngủ","p":249000,"i":"/catalog-media/user_1794152247063_c_1794151762917_1.webp"},"c_1794151769355_2":{"n":"Twinkle Nở Hoa","p":249000,"i":"/catalog-media/user_1794152247063_c_1794151769355_2.webp"},"c_1794151772555_3":{"n":"Twinkle Khủng Long","p":249000,"i":"/catalog-media/user_1794152247063_c_1794151772555_3.webp"},"c_1794151776664_4":{"n":"Twinkle Shinig","p":249000,"i":"/catalog-media/user_1794152247063_c_1794151776664_4.webp"},"c_1794151779569_5":{"n":"Twinkle Táo bón","p":249000,"i":"/catalog-media/user_1794152247063_c_1794151779569_5.webp"},"c_1794152017278_6":{"n":"Twinkle Bé Zoiii","p":249000,"i":"/catalog-media/user_1794152247063_c_1794152017278_6.webp"}}},"user_1793987529864":{"n":"Móc Khoá Donutt Mini","p":65000,"i":"/catalog-media/user_1793987529864_cover.webp","d":"Bộ sưu tập móc khóa len hình bánh Donut mini kết hợp tạo hình các nhân vật hoạt hình Sanrio và thú cưng đáng yêu.","v":{"c_1793987161557_1":{"n":"Donut Pudding","p":65000,"i":"/catalog-media/user_1793987529864_c_1793987161557_1.webp"},"c_1793987165201_2":{"n":"Donut melody","p":65000,"i":"/catalog-media/user_1793987529864_c_1793987165201_2.webp"},"c_1793987182174_3":{"n":"Donut pochaco","p":65000,"i":"/catalog-media/user_1793987529864_c_1793987182174_3.webp"},"c_1793987199983_4":{"n":"Donut ếch ộp","p":65000,"i":"/catalog-media/user_1793987529864_c_1793987199983_4.webp"},"c_1793987209371_5":{"n":"Donutkitty","p":65000,"i":"/catalog-media/user_1793987529864_c_1793987209371_5.webp"},"c_1793987392353_6":{"n":"Donut bò sữa","p":65000,"i":"/catalog-media/user_1793987529864_c_1793987392353_6.webp"}}},"user_1793985079054":{"n":"Bánh Donut Khổng Lồ","p":365000,"i":"/catalog-media/user_1793985079054_cover.webp","d":"Chiếc bánh Donut size khổng lồ phiên bản handmade 100%, chất liệu len nhung đũa siêu mềm mịn kết hợp bông gòn bi đàn hồi cao.","v":{"c_1793984225582_1":{"n":"Donut vị dưa hấu","p":365000,"i":"/catalog-media/user_1793985079054_c_1793984225582_1.webp"},"c_1793984239521_2":{"n":"Donut vị việt quất","p":350000,"i":"/catalog-media/user_1793985079054_c_1793984239521_2.webp"},"c_1793984243388_3":{"n":"Donut vị Bơ","p":350000,"i":"/catalog-media/user_1793985079054_c_1793984243388_3.webp"},"c_1793984246706_4":{"n":"Donut vị chanh vàng","p":350000,"i":"/catalog-media/user_1793985079054_c_1793984246706_4.webp"},"c_1793984252897_5":{"n":"Donut vị khoai môn","p":350000,"i":"/catalog-media/user_1793985079054_c_1793984252897_5.webp"},"c_1793984258973_6":{"n":"Donut vị Socola","p":350000,"i":"/catalog-media/user_1793985079054_c_1793984258973_6.webp"},"c_1793984263755_7":{"n":"Donut vị Đàoo","p":350000,"i":"/catalog-media/user_1793985079054_c_1793984263755_7.webp"}}},"user_1793981290544":{"n":"Donutt size Zừaaa","p":249000,"i":"/catalog-media/user_1793981290544_cover.webp","d":"Chiếc bánh Donut phiên bản thú bông thủ công 100% từ chất liệu len nhung đũa dày dặn, êm ái.","v":{"c_1793980521212_1":{"n":"Donut Chó Snoopy","p":249000,"i":"/catalog-media/user_1793981290544_c_1793980521212_1.webp"},"c_1793980820399_2":{"n":"Donut Gấu Nâu","p":249000,"i":"/catalog-media/user_1793981290544_c_1793980820399_2.webp"},"c_1793980825202_3":{"n":"Donut Cinamorol","p":249000,"i":"/catalog-media/user_1793981290544_c_1793980825202_3.webp"}}},"user_1793976261276":{"n":"Ong Vàng 25cm","p":139000,"i":"/catalog-media/user_1793976261276_cover.webp","d":"Bé Ong Béo phiên bản size lớn 25cm siêu mũm mĩm từ chất liệu len nhung đũa sợi to mềm xốp như mây.","v":{"c_1793976215781_1":{"n":"Ong 25cm","p":139000,"i":"/catalog-media/user_1793976261276_c_1793976215781_1.webp"}}},"user_1793958733621":{"n":"Móc Khoá Gà Béoo","p":49000,"i":"/catalog-media/user_1793958733621_cover.webp","d":"Bé Gà Mập với chất liệu len nhung gấu bông xốp, mềm mịn như nhung vừa ra lò tại tiệm.","v":{"c_1793958591942_1":{"n":"Gà Béoo","p":49000,"i":"/catalog-media/user_1793958733621_c_1793958591942_1.webp"}}},"user_1793958181855":{"n":"Móc Khoá Vịtt BANANA","p":49000,"i":"/catalog-media/user_1793958181855_cover.webp","d":"Vịt Chuối lai giữa bé vịt con mũm mĩm và quả chuối chín vàng ươm đan móc thủ công tỉ mỉ.","v":{"c_1793958000336_1":{"n":"Gà Chuối","p":49000,"i":"/catalog-media/user_1793958181855_c_1793958000336_1.webp"}}},"user_1793956553782":{"n":"Móc Khoá bó hoa mini","p":69000,"i":"/catalog-media/user_1793956553782_cover.webp","d":"Bó hoa len mini có đủ bảng màu xinh xắn, đan móc thủ công từ len nhung gấu.","v":{"c_1793956417108_1":{"n":"bó hoa hồng mini (7bông hồng)","p":69000,"i":"/catalog-media/user_1793956553782_cover.webp"},"c_1793956421634_2":{"n":"bó hướng dương mini ( 5 bông )","p":69000,"i":"/catalog-media/user_1793956553782_c_1793956421634_2.webp"}}},"user_1793955545289":{"n":"Móc khoá Bé Ma Treo Gió","p":49000,"i":"/catalog-media/user_1793955545289_cover.webp","d":"Móc khoá Bé Ma Treo Gió — Mẫu móc khoá đan móc thủ công nhỏ gọn, form đứng chắc chắn.","v":{"c_1793954257159_1":{"n":"Ma 3 mắt","p":49000,"i":"/catalog-media/user_1793955545289_c_1793954257159_1.webp"},"c_1793955268124_2":{"n":"Ma bí ngô","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955268124_2.webp"},"c_1793955283824_3":{"n":"Ma dâu","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955283824_3.webp"},"c_1793955318111_4":{"n":"Ma ếch","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955318111_4.webp"},"c_1793955355143_5":{"n":"Ma heo hồng","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955355143_5.webp"},"c_1793955383931_6":{"n":"Ma phù thuỷ","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955383931_6.webp"},"c_1793955422149_7":{"n":"Ma buồn ngủ","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955422149_7.webp"},"c_1793955452644_8":{"n":"Ma thỏ","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955452644_8.webp"},"c_1793955471835_9":{"n":"Vô Diện","p":49000,"i":"/catalog-media/user_1793955545289_c_1793955471835_9.webp"}}},"user_1793906593712":{"n":"Cừu bông mặt ngố","p":249000,"i":"/catalog-media/user_1793906593712_cover.webp","d":"Cừu bông mặt ngố — Mẫu móc khoá và thú bông đan móc thủ công từ len nhung gấu mềm mịn.","v":{"c_1793906202767_1":{"n":"Cừu bông hồng phấn","p":249000,"i":"/catalog-media/user_1793906593712_c_1793906202767_1.webp"},"c_1793906202767_2":{"n":"Cừu bông hồng sen","p":249000,"i":"/catalog-media/user_1793906593712_c_1793906202767_2.webp"},"c_1793906202767_3":{"n":"Cừu bông mini mặt ngố","p":189000,"i":"/catalog-media/user_1793906593712_c_1793906202767_3.webp"}}},"user_1793905231278":{"n":"Earmuffs Tai Gấu","p":159000,"i":"/catalog-media/user_1793905231278_cover.webp","d":"Earmuffs Tai Gấu — Phụ kiện thủ công từ Len Lông Thỏ êm nhẹ, ấm áp và dễ phối đồ.","v":{"c_1793904987933_2":{"n":"Earmuffs tai gấu nâu","p":159000,"i":"/catalog-media/user_1793905231278_c_1793904987933_2.webp"},"c_1793904987933_3":{"n":"Earmuffs tai gấu trắng","p":159000,"i":"/catalog-media/user_1793905231278_c_1793904987933_3.webp"}}},"user_1793885702524":{"n":"Nón tai gấu","p":189000,"i":"/catalog-media/user_1793885702524_cover.webp","d":"Nón tai gấu — Phụ kiện thủ công từ Len Lông Thỏ mềm mịn, giữ ấm tốt và cực kỳ ăn ảnh.","v":{"c_1793885604415_2":{"n":"Nón tai gấu kem","p":189000,"i":"/catalog-media/user_1793885702524_c_1793885604415_2.webp"},"c_1793885604415_3":{"n":"Nón tai gấu nâu","p":189000,"i":"/catalog-media/user_1793885702524_c_1793885604415_3.webp"},"c_1793885604415_4":{"n":"Nón tai gấu xanh","p":189000,"i":"/catalog-media/user_1793885702524_c_1793885604415_4.webp"}}},"user_1793884910153":{"n":"EarMuffs ( Băng chùm tai )","p":149000,"i":"/catalog-media/user_1793884910153_cover.webp","d":"EarMuffs ( Băng chùm tai ) — Phụ kiện thủ công từ Len Lông Thỏ êm nhẹ, ấm áp.","v":{"c_1793884790378_1":{"n":"Earmuffs đỏ","p":149000,"i":"/catalog-media/user_1793884910153_c_1793884790378_1.webp"},"c_1793884790378_2":{"n":"Earmuffs nâu","p":149000,"i":"/catalog-media/user_1793884910153_c_1793884790378_2.webp"},"c_1793884790378_3":{"n":"Earmuffs xanh rêu","p":149000,"i":"/catalog-media/user_1793884910153_c_1793884790378_3.webp"}}},"user_1793817035699":{"n":"Heo Con Cosplay size 35cm","p":345000,"i":"/catalog-media/user_1793817035699_cover.webp","d":"Bộ sưu tập Gấu Bông Heo Con Cosplay Len Nhung Đũa Handmade siêu cưng và ngộ nghĩnh.","v":{"c_1793816582953_1":{"n":"Heo Cá Hề","p":345000,"i":"/catalog-media/user_1793817035699_c_1793816582953_1.webp"},"c_1793816621139_2":{"n":"Heo Khủng Longg","p":345000,"i":"/catalog-media/user_1793817035699_c_1793816621139_2.webp"},"c_1793816675157_3":{"n":"Heo Cá Mập","p":345000,"i":"/catalog-media/user_1793817035699_c_1793816675157_3.webp"},"c_1793816698913_4":{"n":"Heo Đội Khăn Tắm","p":345000,"i":"/catalog-media/user_1793817035699_c_1793816698913_4.webp"},"c_1793816844678_5":{"n":"heo cosplay Hổ","p":345000,"i":"/catalog-media/user_1793817035699_c_1793816844678_5.webp"},"c_1793816927315_6":{"n":"Heo Cosplay Cừu","p":345000,"i":"/catalog-media/user_1793817035699_c_1793816927315_6.webp"}}},"user_1793815539213":{"n":"Mũ Len Lông Xù Bonnet Hình Trái Cây","p":279000,"i":"/catalog-media/user_1793815539213_cover.webp","d":"Mũ len lông xù dáng Bonnet thủ công với điểm nhấn chóp lá trái cây xinh xắn, chất len bông mềm mịn như lông thỏ.","v":{"c_1793815153681_1":{"n":"Mũ Quả Đàoo","p":279000,"i":"/catalog-media/user_1793815539213_c_1793815153681_1.webp"},"c_1793815178234_2":{"n":"Mũ Quả Chanh","p":279000,"i":"/catalog-media/user_1793815539213_c_1793815178234_2.webp"},"c_1793815203209_3":{"n":"Mũ Quả Cam","p":279000,"i":"/catalog-media/user_1793815539213_c_1793815203209_3.webp"},"c_1793815265543_4":{"n":"Mũ Quả Táo","p":279000,"i":"/catalog-media/user_1793815539213_c_1793815265543_4.webp"}}},"user_1793811032427":{"n":"Móc Khoá  Đầu Heo","p":39000,"i":"/catalog-media/user_1793811032427_cover.webp","d":"Tạo hình chiếc đầu heo tròn đầy với hai chiếc tai nhỏ xinh vểnh nhẹ, đôi mắt đen láy và chiếc mũi hồng đáng yêu.","v":{"c_1":{"n":"Heo Đenn","p":39000,"i":"/catalog-media/user_1793811032427_c_1.webp"},"c_2":{"n":"Heo Hằmm","p":39000,"i":"/catalog-media/user_1793811032427_c_2.webp"}}},"user_1793809415860":{"n":"Móc Khoá Zịtt","p":45000,"i":"/catalog-media/user_1793809415860_cover.webp","d":"Thiết kế form dáng tròn đầy như một viên bánh bao nhỏ, nổi bật với đôi cánh cụp xinh xắn và hai má hồng phớt dễ thương.","v":{"c_1":{"n":"Zịtt Vàng","p":45000,"i":"/catalog-media/user_1793809415860_c_1.webp"},"c_1793810239811_2":{"n":"Zịt Trắngg","p":45000,"i":"/catalog-media/user_1793809415860_c_1793810239811_2.webp"}}},"user_1793806143788":{"n":"Ốc Quế Kem CHảy","p":49000,"i":"/catalog-media/user_1793806143788_cover.webp","d":"Móc khóa len hình kem ốc quế mũm mĩm với viên kem tròn đầy, phần viền bèo nhún mềm mại cùng lớp sốt chảy sinh động.","v":{"c_2":{"n":"Ốc Quế Khoai Mônn Tímm","p":49000,"i":"/catalog-media/user_1793806143788_c_2.webp"},"c_1793811081128_3":{"n":"Ốc Quế Kem Sữa","p":49000,"i":"/catalog-media/user_1793806143788_c_1793811081128_3.webp"}}},"user_1793804889048":{"n":"Đùi Gà Heo","p":49000,"i":"/catalog-media/user_1793804889048_cover.webp","d":"Sự kết hợp độc đáo giữa hình dáng chiếc đùi tròn trịa cùng gương mặt gà con và heo hồng siêu đáng yêu.","v":{"c_1":{"n":"Hồng Phấn","p":49000,"i":"/catalog-media/user_1793804889048_c_1.webp"},"c_2":{"n":"Vàng Bơ","p":49000,"i":"/catalog-media/user_1793804889048_c_2.webp"}}},"user_1793721241087":{"n":"Móc Khoá 12 Cung Hoàng Đạo","p":69000,"i":"/catalog-media/user_1793721241087_cover.webp","d":"Móc Khoá 12 Cung Hoàng Đạo — Mẫu móc khoá đan móc thủ công nhỏ gọn, form đứng chắc chắn từ Len Nhung Gấu.","v":{"c_1793721040375_1":{"n":"Bạch Dương ♈","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_1.webp"},"c_1793721040375_2":{"n":"Kim Ngưu ♉","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_2.webp"},"c_1793721040375_3":{"n":"Song Tử ♊","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_3.webp"},"c_1793721040375_4":{"n":"Cự Giải ♋","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_4.webp"},"c_1793721040375_5":{"n":"Sư Tử ♌","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_5.webp"},"c_1793721040375_6":{"n":"Xử Nữ ♍","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_6.webp"},"c_1793721040375_7":{"n":"Thiên Bình ♎","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_7.webp"},"c_1793721040375_8":{"n":"Thiên Yết ♏","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_8.webp"},"c_1793721040375_9":{"n":"Nhân Mã ♐","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_9.webp"},"c_1793721040375_10":{"n":"Ma Kết ♑","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_10.webp"},"c_1793721040375_11":{"n":"Bảo Bình ♒","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_11.webp"},"c_1793721040375_12":{"n":"Song Ngư ♓","p":69000,"i":"/catalog-media/user_1793721241087_c_1793721040375_12.webp"}}},"vw_pot_rose_01":{"n":"Chậu Hoa Hồng Nhung Cổ Điển Để Bàn Kẽm Nhung","p":125000,"i":"/catalog-media/kem-nhung-pot-rose-red.png","d":"Chậu sứ trắng thắt nơ lụa kem nâng niu 3 đoá hoa hồng nhung được uốn tỉ mỉ từng lớp cánh từ kẽm nhung lông mịn cao cấp.","v":{"c1":{"n":"Đỏ Nhung Ruby","p":125000,"i":"/catalog-media/kem-nhung-pot-rose-red.png"},"c2":{"n":"Hồng Phấn Pastel","p":125000,"i":"/catalog-media/kem-nhung-pot-rose-pink.png"}}},"vw_pot_succulent_02":{"n":"Chậu Cây Sen Đá & Xương Rồng Mini Kẽm Nhung","p":89000,"i":"/catalog-media/kem-nhung-pot-succulent-green.png","d":"Chậu đất nung nhỏ xinh trồng cụm sen đá echeveria và xương rồng mini uốn từ kẽm nhung dày mượt.","v":{"c1":{"n":"Xanh Ngọc Bích","p":89000,"i":"/catalog-media/kem-nhung-pot-succulent-green.png"},"c2":{"n":"Tím Hồng Sương Mai","p":89000,"i":"/catalog-media/kem-nhung-pot-succulent-purple.png"}}},"vw_flower_hydrangea_03":{"n":"Bó Hoa Cẩm Tú Cầu & Lưu Ly Kẽm Nhung Hàn Quốc","p":135000,"i":"/catalog-media/kem-nhung-flower-hydrangea-blue.png","d":"Bó hoa kết hợp hàng chục cánh cẩm tú cầu và hoa lưu ly nhỏ xinh uốn thủ công từ kẽm nhung pastel.","v":{"c1":{"n":"Xanh Dương Sương Sớm","p":135000,"i":"/catalog-media/kem-nhung-flower-hydrangea-blue.png"},"c2":{"n":"Tím Lilac Mộng Mơ","p":135000,"i":"/catalog-media/kem-nhung-flower-hydrangea-purple.png"}}},"combo_couple_zodiac_01":{"n":"Combo \"Couple Định Mệnh\" (Cung Hoàng Đạo & Hoa)","p":139000,"i":"/catalog-media/user_1793721241087_cover.webp","d":"Set đôi hoàn hảo cho các cặp đôi hoặc bạn thân: tự chọn 2 Móc Khoá 12 Cung Hoàng Đạo hoặc phối 1 Cung Hoàng Đạo + 1 Bó Hoa Mini."},"combo_bestie_cute_02":{"n":"Combo \"Đôi Bạn Tri Kỷ — Siêu Lầy & Dễ Thương\"","p":85000,"i":"/catalog-media/user_1793958733621_cover.webp","d":"Mua lẻ 1 bé đã cưng, rủ bạn thân đeo cặp 2 bé còn tiết kiệm hơn! Tự do chọn 2 mẫu bất kỳ trong bộ sưu tập móc khoá lầy lội."},"combo_sweet_bakery_03":{"n":"Combo \"Tiệm Bánh Ngọt Ngào\" (Donut & Kem)","p":99000,"i":"/catalog-media/user_1793987529864_cover.webp","d":"Dành riêng cho những tâm hồn hảo ngọt: kết hợp Móc Khoá Donut Mini cùng Ốc Quế Kem Chảy hoặc Bánh Donut Size Vừa."},"combo_muse_flower_plush_04":{"n":"Combo \"Nàng Thơ — Hoa Không Tàn & Thú Bông\"","p":145000,"i":"/catalog-media/user_1793956553782_cover.webp","d":"Giải pháp quà tặng tinh tế điểm 10 cho dịp Sinh nhật, Kỷ niệm: vừa có Hoa thủ công vĩnh cửu, vừa có Móc Khoá Thú Bông đáng yêu."},"combo_twinkle_universe_05":{"n":"Combo \"Vũ Trụ Twinkle Twinkle\" (Freeship 0₫)","p":379000,"i":"/catalog-media/user_1794152247063_cover.webp","d":"Bộ đôi Charm treo túi xách làm mưa làm gió: kết hợp 1 bé Charm Bông Twinkle Twinkle cùng 1 bé Twinkle Noel & Tự động Freeship toàn quốc!"},"combo_winter_dalat_06":{"n":"Combo \"Đà Lạt Mùa Đông\" (Chùm Tai/Nón & Thú Bông)","p":219000,"i":"/catalog-media/user_1793884910153_cover.webp","d":"Set phụ kiện đồng điệu cho những chuyến vi vu Đà Lạt, Sapa: gồm 1 Băng Chùm Tai EarMuffs hoặc Nón Tai Gấu phối cùng 1 Móc Khoá Thú Bông."}};

function normalizeAbsoluteMediaUrl(rawImg) {
  if (!rawImg || typeof rawImg !== 'string') {
    return 'https://www.tiemcuonlen.shop/logo-512x512.png';
  }
  const trimmed = rawImg.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `https://www.tiemcuonlen.shop${trimmed}`;
  }
  return 'https://www.tiemcuonlen.shop/logo-512x512.png';
}

async function resolveProductOpenGraphMetaServer(rawProductId, rawVariantKey) {
  const baseId = sanitizeTextServer(String(rawProductId || '').split('__')[0], 100);
  const variantKey = sanitizeTextServer(rawVariantKey || '', 100);
  const staticItem = STATIC_OG_CATALOG[baseId] || null;

  let name = staticItem ? staticItem.n : 'Tiệm Cuộn Len — Quà Tặng Đan Móc Thủ Công';
  let price = staticItem ? Number(staticItem.p) || 0 : 0;
  let description = staticItem
    ? staticItem.d
    : 'Chuyên bán sẵn & nhận đặt đan móc thủ công móc khóa len, thú bông len, bó hoa len, chậu hoa kẽm nhung quà tặng cao cấp.';
  let image = staticItem ? staticItem.i : '/logo-512x512.png';
  let variantName = '';

  if (
    staticItem &&
    staticItem.v &&
    variantKey &&
    variantKey !== 'cover' &&
    variantKey !== '1' &&
    staticItem.v[variantKey]
  ) {
    const matchedVar = staticItem.v[variantKey];
    variantName = matchedVar.n || '';
    if (Number(matchedVar.p) > 0) price = Number(matchedVar.p);
    if (matchedVar.i) image = matchedVar.i;
  }

  // Also query Supabase `public.products` with a fast timeout so newly created/edited Admin products have live OG previews
  if (baseId && SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_KEY)) {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 1600) : null;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(
          baseId
        )}&select=id,name,description,price,image,tags&limit=1`,
        {
          headers: buildSupabaseServiceHeaders(),
          signal: controller ? controller.signal : undefined,
        }
      );
      if (res.ok) {
        const rows = await res.json();
        const dbRow = Array.isArray(rows) ? rows[0] : null;
        if (dbRow && dbRow.id) {
          if (dbRow.name) name = String(dbRow.name);
          if (Number(dbRow.price) > 0 && !variantName) {
            price = Number(dbRow.price);
          }
          if (dbRow.description) {
            description = String(dbRow.description)
              .replace(/\s+/g, ' ')
              .slice(0, 180);
          }
          if (
            typeof dbRow.image === 'string' &&
            (dbRow.image.startsWith('http') || dbRow.image.startsWith('/')) &&
            (!variantKey || variantKey === 'cover' || variantKey === '1' || !variantName)
          ) {
            image = dbRow.image;
          }
          if (variantKey && variantKey !== 'cover' && Array.isArray(dbRow.tags)) {
            const varTag = dbRow.tags.find(
              (t) => typeof t === 'string' && t.startsWith('__TCL_VARIANTS_V1__:')
            );
            if (varTag) {
              try {
                const parsed = JSON.parse(varTag.slice('__TCL_VARIANTS_V1__:'.length));
                const colors = Array.isArray(parsed) ? parsed : parsed && parsed.colors;
                if (Array.isArray(colors)) {
                  const foundC = colors.find((c) => c && String(c.id) === variantKey);
                  if (foundC) {
                    if (foundC.name) variantName = String(foundC.name);
                    if (Number(foundC.price) > 0) price = Number(foundC.price);
                    if (
                      typeof foundC.image === 'string' &&
                      (foundC.image.startsWith('http') || foundC.image.startsWith('/'))
                    ) {
                      image = foundC.image;
                    }
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch {
      // fall back to static item
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const fullTitle = variantName ? `${name} (${variantName})` : name;
  const priceLabel = price > 0 ? `${price.toLocaleString('vi-VN')}₫` : '';
  const ogTitle = priceLabel
    ? `${fullTitle} — ${priceLabel} | Tiệm Cuộn Len`
    : `${fullTitle} | Tiệm Cuộn Len`;
  const ogDescription = `🧶 ${description} • Đặt đan thủ công tỉ mỉ tại Tiệm Cuộn Len (tiemcuonlen.shop), tặng kèm hộp quà & thiệp viết tay.`;
  const ogImage = normalizeAbsoluteMediaUrl(image);

  return {
    productId: baseId,
    variantKey,
    fullTitle,
    price,
    priceLabel,
    ogTitle,
    ogDescription,
    ogImage,
  };
}

    module.exports = {
    SUPABASE_URL,
    SUPABASE_KEY,
    SUPABASE_SERVICE_KEY,
    buildSupabaseServiceHeaders,
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
    calculateDynamicPairComboPriceServer,
    resolveComboSlotUnitPriceServer,
    resolveAuthoritativeProductPrices,
    resolveAuthoritativeShippingConfig,
    resolveAuthoritativePromoDiscount,
    issuePersonalMissionVoucherServer,
    markPersonalVoucherUsedServer,
    PERSONAL_VOUCHER_PARTITION,
    logServerAuditEvent,
    withGlobalErrorHandler,
    sendOrderNotificationServer,
    sendCustomerOrderLifecycleEmailServer,
    sendChatNotificationServer,
    sendChatReplyToCustomerServer,
    signBlockedIpRecord,
    verifyBlockedIpRecord,
    resolveProductOpenGraphMetaServer,
    };
