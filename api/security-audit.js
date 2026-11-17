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

      // ─── AUTO-CONFIRMED AUTH PROVISIONING & LEGACY ACCOUNT MIGRATION ─────────
      // Works out-of-the-box on a newly migrated Supabase project:
      // 1. Signs in directly on the server (avoiding client `sb_publishable_...` Bearer header rejection)
      // 2. Creates migrated Admin / Customer accounts once with `email_confirm: true` & preserves legacy `userId` UUID from `public.orders`
      // 3. Auto-confirms unverified accounts & links migrated orders/addresses by email
      // 4. Never overwrites an already-confirmed password account!
      if (action === 'provision_auth_user') {
      if (!checkAuthProvisionRateLimit(telemetry.ip)) {
        return res.status(429).json({
          success: false,
          error: 'Thao tác quá nhanh. Vui lòng thử lại sau 1 phút.',
        });
      }
      if (!SUPABASE_URL || (!SUPABASE_SERVICE_KEY && !SUPABASE_KEY)) {
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
      const publicAuthHeaders = {
        apikey: SUPABASE_KEY || SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      };
      if (
        SUPABASE_KEY &&
        SUPABASE_KEY.split('.').length === 3 &&
        SUPABASE_KEY.startsWith('eyJ')
      ) {
        publicAuthHeaders.Authorization = `Bearer ${SUPABASE_KEY}`;
      }

      const signInViaGoTrueServer = async () => {
        try {
          const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: publicAuthHeaders,
            body: JSON.stringify({ email, password }),
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j && j.access_token) {
            return {
              ok: true,
              session: {
                access_token: j.access_token,
                refresh_token: j.refresh_token,
                expires_in: j.expires_in,
                expires_at: j.expires_at,
                token_type: j.token_type || 'bearer',
                user: j.user,
              },
              errorMsg: '',
            };
          }
          const msg = String(
            j.msg || j.error_description || j.message || ''
          ).toLowerCase();
          return { ok: false, session: null, errorMsg: msg };
        } catch {
          return { ok: false, session: null, errorMsg: 'network_error' };
        }
      };

      const findAndRelinkLegacyCustomerServer = async (activeUserId) => {
        let legacyUserId = '';
        let legacyName = '';
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        try {
          const ordRes = await fetch(
            `${SUPABASE_URL}/rest/v1/orders?select=id,userId,shippingAddress&order=createdAt.desc&limit=250`,
            {
              headers: buildSupabaseServiceHeaders(),
            }
          );
          const rows = ordRes.ok ? await ordRes.json() : [];
          if (Array.isArray(rows)) {
            const matchedOrderIdsToPatch = [];
            const legacyUserIdsToPatch = new Set();
            for (const row of rows) {
              if (!row || !row.shippingAddress) continue;
              const addr =
                typeof row.shippingAddress === 'string'
                  ? JSON.parse(row.shippingAddress)
                  : row.shippingAddress;
              const orderEmail = String((addr && addr.email) || '')
                .toLowerCase()
                .trim();
              if (orderEmail !== email) continue;

              const rowUid = String(row.userId || '').trim();
              if (
                !legacyUserId &&
                uuidRegex.test(rowUid) &&
                rowUid !== HOLDER_USER_ID &&
                rowUid !== '00000000-0000-0000-0000-000000000000'
              ) {
                legacyUserId = rowUid;
              }
              if (!legacyName && addr && addr.fullName) {
                legacyName = sanitizeTextServer(addr.fullName, 80);
              }
              if (activeUserId && rowUid !== String(activeUserId)) {
                matchedOrderIdsToPatch.push(row.id);
                if (
                  uuidRegex.test(rowUid) &&
                  rowUid !== HOLDER_USER_ID &&
                  rowUid !== '00000000-0000-0000-0000-000000000000'
                ) {
                  legacyUserIdsToPatch.add(rowUid);
                }
              }
            }

            if (activeUserId && matchedOrderIdsToPatch.length > 0) {
              const patchHeaders = buildSupabaseServiceHeaders('', {
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              });
              await Promise.all(
                matchedOrderIdsToPatch.slice(0, 30).map((oid) =>
                  fetch(
                    `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(oid)}`,
                    {
                      method: 'PATCH',
                      headers: patchHeaders,
                      body: JSON.stringify({ userId: String(activeUserId) }),
                    }
                  ).catch(() => {})
                )
              );
              for (const oldUid of legacyUserIdsToPatch) {
                await Promise.all([
                  fetch(
                    `${SUPABASE_URL}/rest/v1/addresses?userId=eq.${encodeURIComponent(
                      oldUid
                    )}`,
                    {
                      method: 'PATCH',
                      headers: patchHeaders,
                      body: JSON.stringify({ userId: String(activeUserId) }),
                    }
                  ).catch(() => {}),
                  fetch(
                    `${SUPABASE_URL}/rest/v1/favorites?userId=eq.${encodeURIComponent(
                      oldUid
                    )}`,
                    {
                      method: 'PATCH',
                      headers: patchHeaders,
                      body: JSON.stringify({ userId: String(activeUserId) }),
                    }
                  ).catch(() => {}),
                ]);
              }
            }
          }
        } catch {
          // ignore relink errors
        }
        return { legacyUserId, legacyName };
      };

      const findAuthUserByEmailAdmin = async () => {
        try {
          const listRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
            { method: 'GET', headers: adminHeaders }
          );
          if (!listRes.ok) return null;
          const listData = await listRes.json().catch(() => ({}));
          const usersArr = Array.isArray(listData && listData.users)
            ? listData.users
            : Array.isArray(listData)
            ? listData
            : [];
          return (
            usersArr.find(
              (u) => u && String(u.email || '').toLowerCase().trim() === email
            ) || null
          );
        } catch {
          return null;
        }
      };

      // 1. Fast Path: Check if account already exists and password is valid right now
      const firstSignIn = await signInViaGoTrueServer();
      if (firstSignIn.ok && firstSignIn.session) {
        const signedInUser = firstSignIn.session.user;
        if (
          isAdminEmail &&
          signedInUser &&
          signedInUser.id &&
          (!signedInUser.user_metadata || signedInUser.user_metadata.role !== 'admin')
        ) {
          await Promise.all([
            fetch(`${SUPABASE_URL}/auth/v1/user`, {
              method: 'PUT',
              headers: {
                ...publicAuthHeaders,
                Authorization: `Bearer ${firstSignIn.session.access_token}`,
              },
              body: JSON.stringify({
                data: {
                  ...(signedInUser.user_metadata || {}),
                  role: 'admin',
                },
              }),
            }).catch(() => {}),
            fetch(
              `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(signedInUser.id)}`,
              {
                method: 'PUT',
                headers: adminHeaders,
                body: JSON.stringify({
                  email_confirm: true,
                  user_metadata: {
                    ...(signedInUser.user_metadata || {}),
                    role: 'admin',
                  },
                }),
              }
            ).catch(() => {}),
          ]);
        }
        if (signedInUser && signedInUser.id) {
          await findAndRelinkLegacyCustomerServer(signedInUser.id);
        }
        return res.status(200).json({
          success: true,
          status: 'signed_in',
          session: firstSignIn.session,
        });
      }

      // 2. If `firstSignIn` returned "email not confirmed", the password is 100% verified!
      if (firstSignIn.errorMsg.includes('email not confirmed')) {
        const targetUser = await findAuthUserByEmailAdmin();
        if (targetUser && targetUser.id) {
          await fetch(
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
          const confirmedSignIn = await signInViaGoTrueServer();
          if (confirmedSignIn.ok && confirmedSignIn.session) {
            await findAndRelinkLegacyCustomerServer(
              confirmedSignIn.session.user && confirmedSignIn.session.user.id
            );
            return res.status(200).json({
              success: true,
              status: 'confirmed',
              session: confirmedSignIn.session,
            });
          }
        }
      }

      // 3. Look up migrated customer metadata (existing `userId` UUID & `fullName` from `public.orders`)
      const legacyInfo = await findAndRelinkLegacyCustomerServer(null);
      const effectiveName = cleanAuth.name
        ? displayName
        : sanitizeTextServer(legacyInfo.legacyName || displayName, 80);

      const buildCreatePayload = (includeLegacyId) => ({
        ...(includeLegacyId && legacyInfo.legacyUserId
          ? { id: legacyInfo.legacyUserId }
          : {}),
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: effectiveName,
          full_name: effectiveName,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          role: isAdminEmail ? 'admin' : 'customer',
          avatar: 'capybara',
          auth_provider: authProvider,
        },
      });

      // 4. Attempt to create the user once with `email_confirm: true`
      let createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(buildCreatePayload(true)),
      });

      if (!createRes.ok && legacyInfo.legacyUserId) {
        // Retry without forcing `id` in case the UUID was already taken
        createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify(buildCreatePayload(false)),
        });
      }

      if (createRes.ok) {
        const createdSignIn = await signInViaGoTrueServer();
        if (createdSignIn.session && createdSignIn.session.user) {
          await findAndRelinkLegacyCustomerServer(createdSignIn.session.user.id);
        }
        return res.status(200).json({
          success: true,
          status: 'created',
          session: createdSignIn.session || null,
        });
      }

      // Fallback when `/auth/v1/admin/users` is unavailable (e.g. publishable key mode with `mailer_autoconfirm: true`)
      if (createRes.status === 401 || createRes.status === 403) {
        const publicSignUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: publicAuthHeaders,
          body: JSON.stringify({
            email,
            password,
            data: {
              name: effectiveName,
              full_name: effectiveName,
              ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
              role: isAdminEmail ? 'admin' : 'customer',
              avatar: 'capybara',
              auth_provider: authProvider,
            },
          }),
        });
        if (publicSignUpRes.ok) {
          const signUpJson = await publicSignUpRes.json().catch(() => ({}));
          const createdSignIn = await signInViaGoTrueServer();
          const finalSession =
            createdSignIn.session ||
            (signUpJson && signUpJson.access_token
              ? {
                  access_token: signUpJson.access_token,
                  refresh_token: signUpJson.refresh_token,
                  expires_in: signUpJson.expires_in,
                  expires_at: signUpJson.expires_at,
                  token_type: signUpJson.token_type || 'bearer',
                  user: signUpJson.user,
                }
              : null);
          if (finalSession && finalSession.user && finalSession.user.id) {
            await findAndRelinkLegacyCustomerServer(finalSession.user.id);
          }
          return res.status(200).json({
            success: true,
            status: 'created',
            session: finalSession,
          });
        }
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

      if (alreadyExists) {
        // Check if existing row in `auth.users` was never confirmed or was an OAuth-only placeholder (`TclOAuth#...`)
        const existingUser = await findAuthUserByEmailAdmin();
        if (existingUser && existingUser.id) {
          const existingMeta = existingUser.user_metadata || {};
          const existingProvider = String(existingMeta.auth_provider || '').toLowerCase();
          const isUnconfirmed = !existingUser.email_confirmed_at;
          const isOAuthPlaceholder =
            (existingProvider === 'google' || existingProvider === 'facebook') &&
            authProvider === 'password';

          if (isUnconfirmed || isOAuthPlaceholder) {
            const patchRes = await fetch(
              `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(existingUser.id)}`,
              {
                method: 'PUT',
                headers: adminHeaders,
                body: JSON.stringify({
                  email_confirm: true,
                  password,
                  user_metadata: {
                    ...existingMeta,
                    name: existingMeta.name || effectiveName,
                    full_name: existingMeta.full_name || effectiveName,
                    role: isAdminEmail ? 'admin' : 'customer',
                    auth_provider: authProvider,
                  },
                }),
              }
            );
            if (patchRes.ok) {
              const patchedSignIn = await signInViaGoTrueServer();
              if (patchedSignIn.ok && patchedSignIn.session) {
                await findAndRelinkLegacyCustomerServer(
                  patchedSignIn.session.user && patchedSignIn.session.user.id
                );
                return res.status(200).json({
                  success: true,
                  status: 'confirmed',
                  session: patchedSignIn.session,
                });
              }
            }
          }
        }

        return res.status(401).json({
          success: false,
          status: 'wrong_password',
          error: 'Email hoặc mật khẩu không đúng.',
        });
      }

      // 5. Fallback when Admin API is unavailable: try public `/auth/v1/signup` + sign-in verification
      const signupFallbackRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: publicAuthHeaders,
        body: JSON.stringify({
          email,
          password,
          data: {
            name: effectiveName,
            full_name: effectiveName,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            role: isAdminEmail ? 'admin' : 'customer',
            avatar: 'capybara',
            auth_provider: authProvider,
          },
        }),
      });

      if (signupFallbackRes.ok) {
        const signupJson = await signupFallbackRes.json().catch(() => ({}));
        if (signupJson && signupJson.access_token) {
          const fallbackSession = {
            access_token: signupJson.access_token,
            refresh_token: signupJson.refresh_token,
            expires_in: signupJson.expires_in,
            expires_at: signupJson.expires_at,
            token_type: signupJson.token_type || 'bearer',
            user: signupJson.user,
          };
          if (signupJson.user && signupJson.user.id) {
            await findAndRelinkLegacyCustomerServer(signupJson.user.id);
          }
          return res.status(200).json({
            success: true,
            status: 'created',
            session: fallbackSession,
          });
        }
        const afterFallbackSignIn = await signInViaGoTrueServer();
        if (afterFallbackSignIn.ok && afterFallbackSignIn.session) {
          return res.status(200).json({
            success: true,
            status: 'created',
            session: afterFallbackSignIn.session,
          });
        }
      }

      return res.status(401).json({
        success: false,
        status: 'wrong_password',
        error: 'Email hoặc mật khẩu không đúng.',
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
