const {
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_SERVICE_KEY,
  HOLDER_USER_ID,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  withGlobalErrorHandler,
  sendOrderNotificationServer,
} = require('./_securityCore');

const SEPAY_LOG_PARTITION = '__TCL_SEPAY_LOG_V1__';

module.exports = withGlobalErrorHandler('/api/sepay-webhook', async function handler(req, res) {
  if (req.method === 'GET') {
    const query = req.query || {};
    if (query.action === 'qr' && query.url) {
      const targetUrl = String(query.url);
      if (!targetUrl.startsWith('https://vietqr.app/')) {
        return res.status(400).json({ success: false, message: 'Invalid QR URL' });
      }
      const safeFilename = String(query.filename || 'VietQR-TiemCuonLen.png').replace(
        /[^A-Za-z0-9._-]/g,
        '_'
      );
      const qrRes = await fetch(targetUrl);
      if (!qrRes.ok) {
        return res.status(502).json({ success: false, message: 'Failed to fetch QR' });
      }
      const arrayBuf = await qrRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(buffer);
    }

    return res.status(200).json({
      success: true,
      service: 'Tiệm Cuộn Len — Cổng Webhook Thanh Toán Tự Động SePay',
      domain: 'https://tiemcuonlen.shop',
      webhookUrl: 'https://www.tiemcuonlen.shop/api/sepay-webhook',
      endpoint: '/api/sepay-webhook',
      status: 'active',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const rawBody =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  // Anti-Mass-Assignment: strip undeclared webhook properties while preserving all standard SePay fields
  const body = stripUnknownFieldsServer(rawBody, [
    'id',
    'gateway',
    'transactionDate',
    'accountNumber',
    'subAccount',
    'transferType',
    'transferAmount',
    'amount',
    'accumulated',
    'code',
    'content',
    'description',
    'referenceCode',
  ]);

  const transferType = sanitizeTextServer(body.transferType || 'in', 10).toLowerCase();
  if (transferType !== 'in') {
    return res.status(200).json({
      success: true,
      ignored: true,
      reason: 'Only incoming transactions (transferType=in) are processed',
    });
  }

  const transferAmount = Number(body.transferAmount || body.amount || 0);
  const code = sanitizeTextServer(body.code || '', 200);
  const content = sanitizeTextServer(body.content || '', 300);
  const description = sanitizeTextServer(body.description || '', 300);
  const gateway = sanitizeTextServer(body.gateway || 'Ngân hàng', 80);
  const accountNumber = String(body.accountNumber || '').replace(/[^0-9]/g, '').slice(0, 30);
  const referenceCode = sanitizeTextServer(body.referenceCode || '', 100);
  const transactionDate = sanitizeTextServer(
    body.transactionDate || new Date().toISOString(),
    60
  );

  // Optional webhook secret check if configured in Vercel environment
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = String(
      (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
    );
    if (!authHeader.includes(webhookSecret)) {
      return res.status(401).json({ success: false, message: 'Unauthorized webhook' });
    }
  }

  // Reject zero/negative or non-numeric transfer amounts immediately
  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return res.status(400).json({
      success: false,
      ignored: true,
      reason: 'Invalid transferAmount (must be > 0)',
    });
  }

  // Validate recipient bank account if provided
  const ALLOWED_ACCOUNTS = new Set(['107888618456', '3387966507']);
  if (accountNumber && !ALLOWED_ACCOUNTS.has(accountNumber)) {
    return res.status(400).json({
      success: false,
      ignored: true,
      reason: 'Unrecognized recipient accountNumber',
    });
  }

  const rawText = `${code} ${content} ${description}`.toUpperCase();
  const compactText = rawText.replace(/[^A-Z0-9]/g, '');

  const matchOrderFromList = (list) => {
    if (!Array.isArray(list)) return null;
    for (const order of list) {
      if (!order || !order.id) continue;
      const orderIdUpper = String(order.id).toUpperCase();
      const orderIdCompact = orderIdUpper.replace(/[^A-Z0-9]/g, '');
      const shortDigits = orderIdUpper.replace(/^CUONLEN[-_]?/, '');

      const isMatched =
        compactText.includes(orderIdCompact) ||
        rawText.includes(orderIdUpper) ||
        (shortDigits.length >= 8 && rawText.includes(shortDigits));

      if (isMatched) {
        return order;
      }
    }
    return null;
  };

  // 1. Fast indexed lookup: query pending_payment orders first (uses idx_orders_status_created)
  const pendingOrdersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?status=eq.pending_payment&select=id,userId,total,status,paymentMethod,shippingAddress,items,createdAt&order=createdAt.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  const pendingOrders = pendingOrdersRes.ok ? await pendingOrdersRes.json() : [];
  let matchedOrder = matchOrderFromList(pendingOrders);

  // Fallback for idempotent webhook retries (order already transitioned out of pending_payment)
  if (!matchedOrder) {
    const recentOrdersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?select=id,userId,total,status,createdAt&order=createdAt.desc&limit=40`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const recentOrders = recentOrdersRes.ok ? await recentOrdersRes.json() : [];
    matchedOrder = matchOrderFromList(recentOrders);
  }

  let orderUpdated = false;
  let newStatus = null;

  if (matchedOrder) {
    const expectedTotal = Number(matchedOrder.total || 0);
    const amountValid =
      expectedTotal > 0 &&
      transferAmount >= expectedTotal &&
      matchedOrder.status === 'pending_payment';

    if (amountValid) {
      newStatus = 'Đang xử lý';
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(matchedOrder.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      orderUpdated = patchRes.ok;
      if (orderUpdated) {
        await sendOrderNotificationServer({ ...matchedOrder, status: newStatus });
      }
    }
  }

  // 2. Log webhook event so Admin can inspect real-time SePay transactions
  const logRow = {
    id: `sepay_${body.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: HOLDER_USER_ID,
    fullName: SEPAY_LOG_PARTITION,
    city: matchedOrder ? String(matchedOrder.id) : 'UNMATCHED',
    phone: gateway,
    district: new Date().toISOString(),
    ward: orderUpdated ? 'MATCHED' : 'RECEIVED',
    detailAddress: JSON.stringify({
      sepayId: body.id || null,
      gateway,
      accountNumber,
      transferAmount,
      content: content || code || description,
      referenceCode,
      transactionDate,
      matchedOrderId: matchedOrder ? matchedOrder.id : null,
      orderUpdated,
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
  });

  return res.status(200).json({
    success: true,
    matchedOrderId: matchedOrder ? matchedOrder.id : null,
    orderUpdated,
    newStatus,
  });
});
