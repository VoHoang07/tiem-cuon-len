const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://ljcweaeirwttqoygeoxd.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqY3dlYWVpcnd0dHFveWdlb3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzA0MjUsImV4cCI6MjA5NTIwNjQyNX0.fa1AsIt3qcv24GvUz6Jzup7G_BUwvB4OKPzhQYYvOes';

const SEPAY_LOG_PARTITION = '__TCL_SEPAY_LOG_V1__';
const HOLDER_USER_ID = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const query = req.query || {};
    if (query.action === 'qr' && query.url) {
      try {
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
      } catch (e) {
        return res.status(500).json({ success: false, message: 'QR download error' });
      }
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

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const transferType = String(body.transferType || 'in').toLowerCase();
    if (transferType !== 'in') {
      return res.status(200).json({
        success: true,
        ignored: true,
        reason: 'Only incoming transactions (transferType=in) are processed',
      });
    }

    const transferAmount = Number(body.transferAmount || body.amount || 0);
    const code = String(body.code || '');
    const content = String(body.content || '');
    const description = String(body.description || '');
    const gateway = String(body.gateway || 'Ngân hàng');
    const accountNumber = String(body.accountNumber || '');
    const referenceCode = String(body.referenceCode || '');
    const transactionDate = String(body.transactionDate || new Date().toISOString());

    const rawText = `${code} ${content} ${description}`.toUpperCase();
    const compactText = rawText.replace(/[^A-Z0-9]/g, '');

    // 1. Fetch recent orders from Supabase
    const ordersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?select=id,total,status,paymentMethod&order=createdAt.desc&limit=100`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const orders = ordersRes.ok ? await ordersRes.json() : [];
    let matchedOrder = null;

    if (Array.isArray(orders)) {
      for (const order of orders) {
        if (!order || !order.id) continue;
        const orderIdUpper = String(order.id).toUpperCase(); // e.g. CUONLEN-769732
        const orderIdCompact = orderIdUpper.replace(/[^A-Z0-9]/g, ''); // e.g. CUONLEN769732
        const shortDigits = orderIdUpper.replace(/^CUONLEN[-_]?/, ''); // e.g. 769732

        const isMatched =
          compactText.includes(orderIdCompact) ||
          rawText.includes(orderIdUpper) ||
          (shortDigits.length >= 5 && rawText.includes(shortDigits));

        if (isMatched) {
          matchedOrder = order;
          break;
        }
      }
    }

    let orderUpdated = false;
    let newStatus = null;

    if (matchedOrder) {
      const expectedTotal = Number(matchedOrder.total || 0);
      const amountValid =
        transferAmount <= 0 ||
        transferAmount >= expectedTotal ||
        Math.abs(transferAmount - expectedTotal) <= 1000;

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
      }
    }

    // 2. Log webhook event so Admin & Client can inspect real-time SePay transactions
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
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      matchedOrderId: matchedOrder ? matchedOrder.id : null,
      orderUpdated,
      newStatus,
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      error: err && err.message ? err.message : 'Parse error',
    });
  }
};
