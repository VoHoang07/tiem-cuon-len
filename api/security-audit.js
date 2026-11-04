const {
  SUPABASE_URL,
  SUPABASE_KEY,
  AUDIT_LOG_PARTITION,
  BLOCKLIST_PARTITION,
  HOLDER_USER_ID,
  extractClientTelemetry,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  verifyCsrfRequest,
  verifySupabaseUser,
  withGlobalErrorHandler,
  signBlockedIpRecord,
  verifyBlockedIpRecord,
  syncBlockedIpInMemoryCache,
} = require('./_securityCore');

// Sliding-window rate limit memory bucket per serverless instance
const ipRateWindows = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

function checkServerRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = ipRateWindows.get(key) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  entry.timestamps.push(now);
  ipRateWindows.set(key, entry);

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

module.exports = withGlobalErrorHandler('/api/security-audit', async function handler(req, res) {
  const telemetry = extractClientTelemetry(req);

  const csrf = verifyCsrfRequest(req);
  if (!csrf.valid) {
    return res.status(403).json({
      success: false,
      error: 'Yêu cầu bị từ chối do không hợp lệ (CSRF Guard).',
    });
  }

  const rateStatus = checkServerRateLimit(telemetry.ip);
  if (!rateStatus.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests — Vui lòng thử lại sau 1 phút.',
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

    // RED TEAM FIX: Only verified Admin can read security audit logs & IP blocklist
    const authUser = await verifySupabaseUser(req);
    if (!authUser || !authUser.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Chỉ Quản trị viên mới có quyền truy cập nhật ký hệ thống.',
      });
    }

    const [logsRes, blockRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${AUDIT_LOG_PARTITION}&order=district.desc&limit=120`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${BLOCKLIST_PARTITION}&order=district.desc&limit=100`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      ),
    ]);

    const rawLogs = logsRes.ok ? await logsRes.json() : [];
    const rawBlocks = blockRes.ok ? await blockRes.json() : [];

    if (Array.isArray(rawBlocks)) {
      for (const b of rawBlocks) {
        if (!b || !b.detailAddress) continue;
        try {
          const parsed =
            typeof b.detailAddress === 'string'
              ? JSON.parse(b.detailAddress)
              : b.detailAddress;
          if (verifyBlockedIpRecord(parsed)) {
            syncBlockedIpInMemoryCache(parsed.ip, 'add');
          }
        } catch {
          // ignore
        }
      }
    }

    return res.status(200).json({
      success: true,
      telemetry,
      logs: Array.isArray(rawLogs) ? rawLogs : [],
      blocklist: Array.isArray(rawBlocks) ? rawBlocks : [],
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const rawBody =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  const action = sanitizeTextServer(rawBody.action || 'log', 30);

  // ─── ADMIN-ONLY MANAGEMENT ACTIONS (BLOCK IP / UNBLOCK IP / CLEAR LOGS) ───
  if (action === 'block_ip' || action === 'unblock_ip' || action === 'clear_logs') {
    const authUser = await verifySupabaseUser(req);
    if (!authUser || !authUser.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Chỉ Quản trị viên mới được thực hiện thao tác bảo mật này.',
      });
    }

    if (action === 'block_ip') {
      const rawIpStr = String(rawBody.ip || '').trim();
      // Reject CIDR ranges (/8, /16, /24) or wildcards (*) so a regional subnet can never be blocked
      if (rawIpStr.includes('/') || rawIpStr.includes('*')) {
        return res.status(400).json({
          success: false,
          error: 'Không cho phép chặn theo dải mạng (CIDR/Wildcard) để tránh chặn nhầm khách hàng cùng vùng.',
        });
      }
      const targetIp = sanitizeTextServer(rawIpStr, 45).replace(/[^0-9a-fA-F.:]/g, '');
      const reason = sanitizeTextServer(
        rawBody.reason || 'Chặn thủ công bởi Quản trị viên',
        160
      );
      if (!targetIp || targetIp === '0.0.0.0' || targetIp === '127.0.0.1' || targetIp === '::1') {
        return res.status(400).json({ success: false, error: 'Địa chỉ IP không hợp lệ.' });
      }
      const nowIso = new Date().toISOString();
      const entry = {
        id: `block_${targetIp.replace(/[^a-zA-Z0-9]/g, '_')}`,
        ip: targetIp,
        reason,
        blockedBy: authUser.email,
        createdAt: nowIso,
        sig: signBlockedIpRecord(targetIp, nowIso),
      };
      const row = {
        id: entry.id,
        userId: HOLDER_USER_ID,
        fullName: BLOCKLIST_PARTITION,
        phone: targetIp,
        city: reason.slice(0, 120),
        district: nowIso,
        ward: 'BLOCKED',
        detailAddress: JSON.stringify(entry),
        isDefault: false,
      };
      await fetch(`${SUPABASE_URL}/rest/v1/addresses?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
      });
      syncBlockedIpInMemoryCache(targetIp, 'add');
      return res.status(200).json({ success: true, blocked: entry });
    }

    if (action === 'unblock_ip') {
      const targetIp = sanitizeTextServer(rawBody.ip, 45).replace(/[^0-9a-fA-F.:]/g, '');
      const blockId = `block_${targetIp.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await fetch(
        `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${BLOCKLIST_PARTITION}&or=(id.eq.${encodeURIComponent(blockId)},phone.eq.${encodeURIComponent(targetIp)})`,
        {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      );
      syncBlockedIpInMemoryCache(targetIp, 'remove');
      return res.status(200).json({ success: true, unblockedIp: targetIp });
    }

    if (action === 'clear_logs') {
      await fetch(
        `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${AUDIT_LOG_PARTITION}`,
        {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      );
      return res.status(200).json({ success: true });
    }
  }

  // ─── DEFAULT ACTION: RECORD AUDIT EVENT ───────────────────────────────────
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
      : sanitizeTextServer(body.ip || 'unknown', 45);
  const locationLabel =
    [telemetry.city, telemetry.region, telemetry.country].filter(Boolean).join(', ') ||
    sanitizeTextServer(body.location || 'VN', 100);

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
      asn: telemetry.asn || sanitizeTextServer(body.asn || '', 40),
      eventType,
      severity,
      path,
      method,
      userEmail,
      userId: body.actorUserId ? sanitizeTextServer(body.actorUserId, 60) : null,
      userAgent: telemetry.userAgent || sanitizeTextServer(body.userAgent || '', 260),
      screenSize: sanitizeTextServer(body.screenSize || '', 40),
      language: sanitizeTextServer(body.language || 'vi-VN', 30),
      referer: telemetry.referer || sanitizeTextServer(body.referer || 'Direct', 200),
      details: body.details && typeof body.details === 'object' ? body.details : {},
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

  return res.status(200).json({
    success: true,
    telemetry,
    loggedId: logRow.id,
  });
});
