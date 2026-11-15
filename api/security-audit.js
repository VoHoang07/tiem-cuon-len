const {
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_SERVICE_KEY,
  buildSupabaseServiceHeaders,
  ADMIN_EMAILS,
  AUDIT_LOG_PARTITION,
  BLOCKLIST_PARTITION,
  HOLDER_USER_ID,
  extractClientTelemetry,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  verifyCsrfRequest,
  verifySupabaseUser,
  withGlobalErrorHandler,
  sendChatNotificationServer,
  sendChatReplyToCustomerServer,
  signBlockedIpRecord,
  verifyBlockedIpRecord,
  syncBlockedIpInMemoryCache,
  } = require('./_securityCore');

  // Sliding-window rate limit memory bucket per serverless instance
  const ipRateWindows = new Map();
  const authProvisionWindows = new Map();
  const chatNotifyCooldowns = new Map();
  const RATE_WINDOW_MS = 60 * 1000;
  const MAX_REQUESTS_PER_WINDOW = 60;

  function checkAuthProvisionRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = authProvisionWindows.get(key) || { ts: [] };
  entry.ts = entry.ts.filter((t) => now - t < 60 * 1000);
  entry.ts.push(now);
  authProvisionWindows.set(key, entry);
  if (authProvisionWindows.size > 1000) {
    const oldest = authProvisionWindows.keys().next().value;
    if (oldest) authProvisionWindows.delete(oldest);
  }
  return entry.ts.length <= 10;
  }

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
        `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${AUDIT_LOG_PARTITION}&order=district.desc&limit=400`,
        {
          headers: buildSupabaseServiceHeaders(authUser.accessToken),
        }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${HOLDER_USER_ID}&fullName=eq.${BLOCKLIST_PARTITION}&order=district.desc&limit=100`,
        {
          headers: buildSupabaseServiceHeaders(authUser.accessToken),
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
        headers: buildSupabaseServiceHeaders(authUser.accessToken, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
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
          headers: buildSupabaseServiceHeaders(authUser.accessToken),
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
          headers: buildSupabaseServiceHeaders(authUser.accessToken),
        }
      );
      return res.status(200).json({ success: true });
      }
    }

    // ─── LIVE CHAT OWNER NOTIFICATION (WORKS EVEN WHEN ADMIN HAS WEB CLOSED) ──
    if (action === 'notify_chat') {
    const cleanChat = stripUnknownFieldsServer(rawBody, [
      'conversationId',
      'customerName',
      'customerEmail',
      'text',
      'productName',
    ]);
    const text = sanitizeTextServer(cleanChat.text || '', 600);
    if (!text) {
      return res.status(400).json({ success: false, error: 'Empty chat message' });
    }
    const convKey = `${telemetry.ip}_${sanitizeTextServer(
      cleanChat.conversationId || 'default',
      60
    )}`;
    const nowTs = Date.now();
    const lastSent = chatNotifyCooldowns.get(convKey) || 0;
    if (nowTs - lastSent < 12000) {
      return res.status(200).json({ success: true, throttled: true });
    }
    chatNotifyCooldowns.set(convKey, nowTs);
    if (chatNotifyCooldowns.size > 500) {
      const firstK = chatNotifyCooldowns.keys().next().value;
      if (firstK) chatNotifyCooldowns.delete(firstK);
    }

    const notified = await sendChatNotificationServer(cleanChat);
    return res.status(200).json({ success: true, notified });
    }

    // ─── LIVE CHAT REPLY NOTIFICATION TO CUSTOMER (WHEN CUSTOMER LEFT WEB) ────
    if (action === 'notify_customer_reply') {
    const cleanReply = stripUnknownFieldsServer(rawBody, [
      'conversationId',
      'customerName',
      'customerEmail',
      'text',
      'productName',
    ]);
    const text = sanitizeTextServer(cleanReply.text || '', 600);
    const customerEmail = sanitizeTextServer(
      cleanReply.customerEmail || '',
      120
    );
    if (!text || !customerEmail) {
      return res
        .status(200)
        .json({ success: true, notified: false, reason: 'missing_email' });
    }
    const convKey = `reply_${sanitizeTextServer(
      cleanReply.conversationId || customerEmail,
      80
    )}`;
    const nowTs = Date.now();
    const lastSent = chatNotifyCooldowns.get(convKey) || 0;
    if (nowTs - lastSent < 8000) {
      return res.status(200).json({ success: true, throttled: true });
    }
    chatNotifyCooldowns.set(convKey, nowTs);

    const notified = await sendChatReplyToCustomerServer(cleanReply);
    return res.status(200).json({ success: true, notified });
    }

    // ─── ADMIN DELETE CHAT CONVERSATION OR SINGLE MESSAGE ─────────────────────
    if (action === 'delete_chat') {
      const adminUser = await verifySupabaseUser(req);
      if (!adminUser || !adminUser.isAdmin) {
        return res
          .status(403)
          .json({ success: false, error: 'Chỉ Quản trị viên mới có quyền xóa tin nhắn.' });
      }
      const cleanDel = stripUnknownFieldsServer(rawBody, [
        'conversationId',
        'messageId',
      ]);
      const convId = sanitizeTextServer(cleanDel.conversationId || '', 120);
      const msgId = sanitizeTextServer(cleanDel.messageId || '', 120);
      const delHeaders = buildSupabaseServiceHeaders(adminUser.accessToken);

      if (msgId) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/addresses?fullName=eq.__TCL_CHAT_V2__&id=eq.${encodeURIComponent(
            msgId
          )}`,
          {
            method: 'DELETE',
            headers: delHeaders,
          }
        );
      } else if (convId) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/addresses?fullName=eq.__TCL_CHAT_V2__&city=eq.${encodeURIComponent(
            convId
          )}`,
          {
            method: 'DELETE',
            headers: delHeaders,
          }
        );
      }
      return res.status(200).json({ success: true });
      }

      // ─── AUTO-CONFIRMED AUTH PROVISIONING FOR NEW SUPABASE PROJECT ────────────
      // Works out-of-the-box even when GoTrue `mailer_autoconfirm` is OFF:
      // - Creates a brand-new account ONCE with `email_confirm: true`
      // - Or confirms an unverified account ONLY after verifying the user's real password via `/auth/v1/token`
      // - NEVER overwrites an existing confirmed user's password!
      if (action === 'provision_auth_user') {
      if (!checkAuthProvisionRateLimit(telemetry.ip)) {
        return res.status(429).json({
          success: false,
          error: 'Thao tác quá nhanh. Vui lòng thử lại sau 1 phút.',
        });
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === SUPABASE_KEY) {
        return res.status(503).json({
          success: false,
          error: 'Máy chủ chưa sẵn sàng đồng bộ xác thực.',
        });
      }

      const cleanAuth = stripUnknownFieldsServer(rawBody, [
        'email',
        'password',
        'name',
        'avatarUrl',
        'authProvider',
      ]);

      const email = sanitizeTextServer(cleanAuth.email || '', 120)
        .toLowerCase()
        .trim();
      const password = typeof cleanAuth.password === 'string' ? cleanAuth.password : '';
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        password.length < 6 ||
        password.length > 128
      ) {
        return res.status(400).json({
          success: false,
          error: 'Email hoặc mật khẩu không hợp lệ.',
        });
      }

      const isAdminEmail = ADMIN_EMAILS.has(email);
      const displayName = sanitizeTextServer(
        cleanAuth.name || (isAdminEmail ? 'Quản trị viên' : email.split('@')[0]),
        80
      );
      const avatarUrl = sanitizeTextServer(cleanAuth.avatarUrl || '', 400);
      const authProvider = sanitizeTextServer(cleanAuth.authProvider || 'password', 24);

      const adminHeaders = buildSupabaseServiceHeaders('', {
        'Content-Type': 'application/json',
      });

      // 1. Attempt to create the user once with `email_confirm: true`
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: displayName,
            full_name: displayName,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            role: isAdminEmail ? 'admin' : 'customer',
            avatar: 'capybara',
            auth_provider: authProvider,
          },
        }),
      });

      if (createRes.ok) {
        return res.status(200).json({ success: true, status: 'created' });
      }

      const createErrJson = await createRes.json().catch(() => ({}));
      const createMsg = String(
        createErrJson.msg || createErrJson.message || createErrJson.error_description || ''
      ).toLowerCase();

      const alreadyExists =
        createRes.status === 422 ||
        createMsg.includes('already') ||
        createMsg.includes('exists') ||
        createMsg.includes('registered');

      if (!alreadyExists) {
        // Fallback when GoTrue Admin API rejects key format or returns transient error:
        // Use standard public `/auth/v1/signup` (when `mailer_autoconfirm: true`, this creates & confirms immediately;
        // if the user already exists, GoTrue returns `user_already_exists` or obfuscated empty identities without overwriting password).
        const signupFallbackRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            data: {
              name: displayName,
              full_name: displayName,
              ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
              role: isAdminEmail ? 'admin' : 'customer',
              avatar: 'capybara',
              auth_provider: authProvider,
            },
          }),
        });

        if (signupFallbackRes.ok) {
          const signupJson = await signupFallbackRes.json().catch(() => ({}));
          const createdUser = signupJson.user || signupJson;
          const identities = Array.isArray(createdUser && createdUser.identities)
            ? createdUser.identities
            : null;
          // Non-empty identities or access_token means a brand-new account was just created
          if (signupJson.access_token || (identities && identities.length > 0)) {
            return res.status(200).json({ success: true, status: 'created' });
          }
        }
      }

      // 2. Account already exists: test password against GoTrue `/auth/v1/token`
      // GoTrue checks the password BEFORE checking `email_confirmed_at`!
      // - Wrong password -> returns "Invalid login credentials" -> strictly reject!
      // - Right password + unconfirmed -> returns "Email not confirmed" -> safely confirm email!
      const checkTokenRes = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      );

      if (checkTokenRes.ok) {
        return res.status(200).json({ success: true, status: 'already_confirmed' });
      }

      const tokenErrJson = await checkTokenRes.json().catch(() => ({}));
      const tokenErrMsg = String(
        tokenErrJson.msg ||
          tokenErrJson.error_description ||
          tokenErrJson.message ||
          ''
      ).toLowerCase();

      if (!tokenErrMsg.includes('email not confirmed')) {
        return res.status(401).json({
          success: false,
          status: 'wrong_password',
          error: 'Email hoặc mật khẩu không đúng.',
        });
      }

      // 3. Password matched an unconfirmed user -> Confirm `email_confirm: true` via Admin API
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`,
        { method: 'GET', headers: adminHeaders }
      );
      if (listRes.ok) {
        const listData = await listRes.json().catch(() => ({}));
        const usersArr = Array.isArray(listData && listData.users)
          ? listData.users
          : Array.isArray(listData)
          ? listData
          : [];
        const targetUser = usersArr.find(
          (u) => u && String(u.email || '').toLowerCase().trim() === email
        );
        if (targetUser && targetUser.id) {
          const patchRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetUser.id)}`,
            {
              method: 'PUT',
              headers: adminHeaders,
              body: JSON.stringify({
                email_confirm: true,
                user_metadata: {
                  ...(targetUser.user_metadata || {}),
                  role: isAdminEmail ? 'admin' : 'customer',
                },
              }),
            }
          );
          if (patchRes.ok) {
            return res.status(200).json({ success: true, status: 'confirmed' });
          }
        }
      }

      return res.status(400).json({
        success: false,
        error: 'Không thể kích hoạt xác nhận email tự động.',
      });
      }

      // ─── DEFAULT ACTION: RECORD AUDIT EVENT ───────────────────────────────────
  const body = stripUnknownFieldsServer(rawBody, [
    'eventType',
    'severity',
    'path',
    'method',
    'userEmail',
    'actorUserId',
    'visitorId',
    'sessionId',
    'visitorNumber',
    'isAdminActor',
    'customerName',
    'customerPhone',
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
  const safeVisitorId = sanitizeTextServer(body.visitorId || '', 64);
  const safeSessionId = sanitizeTextServer(body.sessionId || '', 64);
  const safeCustomerName = sanitizeTextServer(body.customerName || '', 80);
  const safeCustomerPhone = sanitizeTextServer(body.customerPhone || '', 24);
  const safeVisitorNum = Math.max(1, Math.min(9999, Number(body.visitorNumber) || 1));
  const safeIsAdminActor = Boolean(body.isAdminActor);

  const rawDetails = body.details && typeof body.details === 'object' ? body.details : {};
  const sanitizedDetails = {};
  for (const [k, v] of Object.entries(rawDetails).slice(0, 18)) {
    const cleanKey = sanitizeTextServer(k, 40);
    if (!cleanKey) continue;
    if (typeof v === 'number' || typeof v === 'boolean') {
      sanitizedDetails[cleanKey] = v;
    } else if (v !== null && v !== undefined) {
      sanitizedDetails[cleanKey] = sanitizeTextServer(String(v), 220);
    }
  }

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
      visitorId: safeVisitorId || undefined,
      sessionId: safeSessionId || undefined,
      visitorNumber: safeVisitorNum,
      isAdminActor: safeIsAdminActor,
      customerName: safeCustomerName || undefined,
      customerPhone: safeCustomerPhone || undefined,
      userAgent: telemetry.userAgent || sanitizeTextServer(body.userAgent || '', 260),
      screenSize: sanitizeTextServer(body.screenSize || '', 40),
      language: sanitizeTextServer(body.language || 'vi-VN', 30),
      referer:
        sanitizeTextServer(body.referer || '', 220) ||
        telemetry.referer ||
        'Direct',
      details: sanitizedDetails,
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

  return res.status(200).json({
    success: true,
    telemetry,
    loggedId: logRow.id,
  });
});
