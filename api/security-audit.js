const {
  SUPABASE_URL,
  SUPABASE_KEY,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  applySecureCookiesAndHeaders,
  verifyCsrfRequest,
} = require('./_securityCore');

const AUDIT_LOG_PARTITION = '__TCL_SECURITY_AUDIT_LOG_V1__';
const BLOCKLIST_PARTITION = '__TCL_SECURITY_BLOCKLIST_V1__';
const HOLDER_USER_ID = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';

// Sliding-window rate limit memory bucket per serverless instance
const ipRateWindows = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

function extractClientTelemetry(req) {
  const headers = (req && req.headers) || {};
  const rawForwarded = String(headers['x-forwarded-for'] || '');
  const firstForwardedIp = rawForwarded.split(',')[0].trim();
  const ip =
    String(headers['cf-connecting-ip'] || '').trim() ||
    String(headers['x-real-ip'] || '').trim() ||
    firstForwardedIp ||
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

function checkServerRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = ipRateWindows.get(key) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  entry.timestamps.push(now);
  ipRateWindows.set(key, entry);

  // Prevent unbounded Map growth
  if (ipRateWindows.size > 2000) {
    const oldestKey = ipRateWindows.keys().next().value;
    if (oldestKey) ipRateWindows.delete(oldestKey);
  }

  return {
    allowed: entry.timestamps.length <= MAX_REQUESTS_PER_WINDOW,
    count: entry.timestamps.length,
    limit: MAX_REQUESTS_PER_WINDOW,
  };
}

module.exports = async function handler(req, res) {
  const telemetry = extractClientTelemetry(req);
  applySecureCookiesAndHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const csrf = verifyCsrfRequest(req);
  if (!csrf.valid) {
    return res.status(403).json({
      success: false,
      error: 'CSRF verification failed: ' + csrf.reason,
    });
  }

  const rateStatus = checkServerRateLimit(telemetry.ip);
  if (!rateStatus.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests — Vui lòng thử lại sau 1 phút.',
      ip: telemetry.ip,
    });
  }

  if (req.method === 'GET') {
    const query = req.query || {};
    if (query.action === 'whoami') {
      return res.status(200).json({
        success: true,
        telemetry,
        rateLimit: rateStatus,
      });
    }

    try {
      const [logsRes, blockRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${AUDIT_LOG_PARTITION}&order=district.desc&limit=120`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${BLOCKLIST_PARTITION}&order=district.desc&limit=100`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        ),
      ]);

      const rawLogs = logsRes.ok ? await logsRes.json() : [];
      const rawBlocks = blockRes.ok ? await blockRes.json() : [];

      return res.status(200).json({
        success: true,
        telemetry,
        logs: Array.isArray(rawLogs) ? rawLogs : [],
        blocklist: Array.isArray(rawBlocks) ? rawBlocks : [],
      });
    } catch (e) {
      return res.status(200).json({
        success: true,
        telemetry,
        logs: [],
        blocklist: [],
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const rawBody =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    // Anti-Mass-Assignment: strip unknown fields
    const body = stripUnknownFieldsServer(rawBody, [
      'eventType',
      'severity',
      'path',
      'method',
      'userEmail',
      'actorUserId',
      'ip',
      'location',
      'asn',
      'userAgent',
      'screenSize',
      'language',
      'referer',
      'details',
      'hiddenTrap',
    ]);

    // Check if client filled a hidden bot-trap field
    if (body.hiddenTrap && String(body.hiddenTrap).trim().length > 0) {
      body.eventType = 'BOT_TRAP_TRIGGERED';
      body.severity = 'CRITICAL';
    }

    const eventType = sanitizeTextServer(body.eventType || 'PAGE_VISIT', 60);
    const severity = sanitizeTextServer(body.severity || 'INFO', 20);
    const path = sanitizeTextServer(body.path || '/', 200);
    const method = sanitizeTextServer(body.method || 'CLIENT', 30);
    const userEmail = sanitizeTextServer(body.userEmail || 'Khách (Guest)', 120);
    const clientIp =
      telemetry.ip !== 'unknown'
        ? telemetry.ip
        : String(body.ip || 'unknown').slice(0, 80);
    const locationLabel = [telemetry.city, telemetry.region, telemetry.country]
      .filter(Boolean)
      .join(', ') || String(body.location || 'VN').slice(0, 100);

    const nowIso = new Date().toISOString();
    const logRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: HOLDER_USER_ID,
      fullName: AUDIT_LOG_PARTITION,
      phone: clientIp.slice(0, 45),
      city: eventType,
      district: nowIso,
      ward: severity,
      detailAddress: JSON.stringify({
        ip: clientIp,
        location: locationLabel,
        asn: telemetry.asn || body.asn || '',
        eventType,
        severity,
        path,
        method,
        userEmail,
        userId: body.actorUserId || null,
        userAgent: telemetry.userAgent || body.userAgent || '',
        screenSize: String(body.screenSize || '').slice(0, 40),
        language: String(body.language || '').slice(0, 30),
        referer: telemetry.referer || String(body.referer || '').slice(0, 200),
        details: body.details || {},
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
      },
      body: JSON.stringify(logRow),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      telemetry,
      loggedId: logRow.id,
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      error: err && err.message ? err.message : 'Audit log error',
    });
  }
};
