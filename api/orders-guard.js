const {
  SUPABASE_URL,
  SUPABASE_KEY,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  applySecureCookiesAndHeaders,
  verifyCsrfRequest,
  verifySupabaseUser,
  resolveAuthoritativeProductPrices,
} = require('./_securityCore');

const ALLOWED_STATUSES = new Set([
  'pending_payment',
  'Đang xử lý',
  'Đang chuẩn bị hàng',
  'Đang giao',
  'Hoàn thành',
  'Đã hủy',
]);

module.exports = async function handler(req, res) {
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

  const authUser = await verifySupabaseUser(req);
  if (!authUser) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Vui lòng đăng nhập lại.',
    });
  }

  // ─── GET ORDER BY ID (WITH ANTI-IDOR OWNERSHIP CHECK) ───────────────────────
  if (req.method === 'GET') {
    const orderId = sanitizeTextServer((req.query && req.query.orderId) || '', 80);
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing orderId' });
    }

    try {
      const orderRes = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      );
      const rows = orderRes.ok ? await orderRes.json() : [];
      const order = Array.isArray(rows) ? rows[0] : null;
      if (!order) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng.' });
      }

      // Anti-IDOR: Only the order owner or verified Admin can access the order
      if (!authUser.isAdmin && String(order.userId) !== authUser.id) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden (Anti-IDOR): Bạn không có quyền xem đơn hàng của người khác.',
        });
      }

      return res.status(200).json({ success: true, order });
    } catch {
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const rawBody =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const action = sanitizeTextServer(rawBody.action || 'create', 30);

    // ─── 1. CREATE ORDER (SERVER-SIDE PRICE CALCULATION & ANTI-MASS-ASSIGNMENT) ───
    if (action === 'create') {
      const cleanOrder = stripUnknownFieldsServer(rawBody.order, [
        'id',
        'items',
        'shippingAddress',
        'paymentMethod',
        'shippingOption',
      ]);

      const rawItems = Array.isArray(cleanOrder.items) ? cleanOrder.items : [];
      if (rawItems.length === 0 || rawItems.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Danh sách sản phẩm trong đơn hàng không hợp lệ.',
        });
      }

      const baseIds = rawItems.map((it) => {
        const p = (it && it.product) || {};
        return String(p.baseProductId || p.id || '').split('__')[0];
      });
      const priceMap = await resolveAuthoritativeProductPrices(baseIds);

      let authoritativeSubtotal = 0;
      const sanitizedItems = [];

      for (const it of rawItems) {
        if (!it || !it.product) continue;
        const rawProd = stripUnknownFieldsServer(it.product, [
          'id',
          'baseProductId',
          'name',
          'category',
          'material',
          'color',
          'image',
          'price',
          'isMadeToOrder',
          'selectedColorId',
          'selectedColorName',
          'selectedColorHex',
        ]);

        const baseId = String(rawProd.baseProductId || rawProd.id || '').split('__')[0];
        const qty = Math.max(1, Math.min(99, Math.round(Number(it.quantity) || 1)));
        const serverUnitPrice = priceMap.get(baseId) || Math.max(1000, Math.round(Number(rawProd.price) || 0));

        if (!baseId || serverUnitPrice <= 0) {
          return res.status(400).json({
            success: false,
            error: `Sản phẩm không hợp lệ: ${baseId}`,
          });
        }

        authoritativeSubtotal += serverUnitPrice * qty;

        sanitizedItems.push({
          product: {
            id: sanitizeTextServer(rawProd.id || baseId, 100),
            baseProductId: sanitizeTextServer(baseId, 80),
            name: sanitizeTextServer(rawProd.name, 160),
            category: sanitizeTextServer(rawProd.category || 'Crochet', 40),
            material: sanitizeTextServer(rawProd.material || '', 120),
            color: sanitizeTextServer(rawProd.color || '', 80),
            image: typeof rawProd.image === 'string' ? rawProd.image : null,
            price: serverUnitPrice,
            isMadeToOrder: rawProd.isMadeToOrder !== false,
            selectedColorId: rawProd.selectedColorId
              ? sanitizeTextServer(rawProd.selectedColorId, 60)
              : undefined,
            selectedColorName: rawProd.selectedColorName
              ? sanitizeTextServer(rawProd.selectedColorName, 80)
              : undefined,
            selectedColorHex: rawProd.selectedColorHex
              ? sanitizeTextServer(rawProd.selectedColorHex, 20)
              : undefined,
          },
          quantity: qty,
          price: serverUnitPrice,
        });
      }

      // Sanitize shipping address & compute authoritative shipping fee
      const rawAddr = stripUnknownFieldsServer(cleanOrder.shippingAddress, [
        'id',
        'fullName',
        'phone',
        'city',
        'district',
        'ward',
        'detailAddress',
        'shippingMethod',
        'shippingFee',
      ]);

      const city = sanitizeTextServer(rawAddr.city, 80);
      const shippingMethod = sanitizeTextServer(rawAddr.shippingMethod || '', 120);
      const isPickupOrExpress =
        shippingMethod.toLowerCase().includes('ghé tiệm') ||
        shippingMethod.toLowerCase().includes('hỏa tốc');
      const isHcm =
        city.toLowerCase().includes('hồ chí minh') ||
        city.toLowerCase().includes('hcm') ||
        city.toLowerCase().includes('sài gòn');

      let authoritativeShippingFee = 0;
      if (!isPickupOrExpress) {
        if (authoritativeSubtotal >= 150000) {
          authoritativeShippingFee = 0;
        } else {
          authoritativeShippingFee = isHcm ? 20000 : 30000;
        }
      }

      const authoritativeTotal = authoritativeSubtotal + authoritativeShippingFee;
      const paymentMethod = sanitizeTextServer(cleanOrder.paymentMethod, 100);
      const isCod =
        paymentMethod.toLowerCase().includes('cod') ||
        paymentMethod.toLowerCase().includes('khi nhận hàng');

      // Server enforces initial status — prevents client from injecting `status: 'Hoàn thành'`
      const authoritativeStatus = isCod ? 'Đang xử lý' : 'pending_payment';

      const orderIdRaw = sanitizeTextServer(cleanOrder.id, 60).replace(/[^A-Za-z0-9_-]/g, '');
      const orderId = orderIdRaw.startsWith('CUONLEN-')
        ? orderIdRaw
        : `CUONLEN-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6)}`;

      const finalOrder = {
        id: orderId,
        userId: authUser.id, // Enforced from verified JWT (Anti-IDOR)
        items: sanitizedItems,
        total: authoritativeTotal,
        shippingAddress: {
          id: sanitizeTextServer(rawAddr.id || `addr_${Date.now()}`, 60),
          userId: authUser.id,
          fullName: sanitizeTextServer(rawAddr.fullName, 80),
          phone: sanitizeTextServer(rawAddr.phone, 20).replace(/[^0-9+]/g, ''),
          city,
          district: sanitizeTextServer(rawAddr.district, 80),
          ward: sanitizeTextServer(rawAddr.ward, 80),
          detailAddress: sanitizeTextServer(rawAddr.detailAddress, 220),
          shippingMethod,
          shippingFee: authoritativeShippingFee,
        },
        paymentMethod,
        status: authoritativeStatus,
        createdAt: new Date().toISOString(),
      };

      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(finalOrder),
      });

      if (!upsertRes.ok) {
        return res.status(500).json({
          success: false,
          error: 'Không thể lưu đơn hàng vào cơ sở dữ liệu.',
        });
      }

      return res.status(200).json({
        success: true,
        order: finalOrder,
      });
    }

    // ─── 2. UPDATE ORDER STATUS / SHIPPING (ADMIN OR OWNER CANCEL ONLY) ───────
    if (action === 'update_status' || action === 'update_shipping') {
      const cleanUpdate = stripUnknownFieldsServer(rawBody, [
        'orderId',
        'status',
        'shippingCarrier',
        'trackingCode',
      ]);

      const orderId = sanitizeTextServer(cleanUpdate.orderId, 80);
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'Missing orderId' });
      }

      // Fetch target order to verify ownership (Anti-IDOR)
      const orderRes = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      );
      const rows = orderRes.ok ? await orderRes.json() : [];
      const existingOrder = Array.isArray(rows) ? rows[0] : null;
      if (!existingOrder) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const nextStatus = cleanUpdate.status
        ? sanitizeTextServer(cleanUpdate.status, 40)
        : existingOrder.status;

      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      // Role & Ownership check:
      // Only Admin can set status to Đang chuẩn bị hàng / Đang giao / Hoàn thành or update tracking
      if (!authUser.isAdmin) {
        const isOwner = String(existingOrder.userId) === authUser.id;
        const isCustomerCancelAllowed =
          isOwner &&
          nextStatus === 'Đã hủy' &&
          (existingOrder.status === 'pending_payment' || existingOrder.status === 'Đang xử lý');

        if (!isCustomerCancelAllowed) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: Chỉ Quản trị viên mới có quyền cập nhật trạng thái/vận đơn này.',
          });
        }
      }

      const updatePayload = { status: nextStatus };
      if (authUser.isAdmin && action === 'update_shipping') {
        const prevAddr = existingOrder.shippingAddress || {};
        const carrier =
          cleanUpdate.shippingCarrier !== undefined
            ? sanitizeTextServer(cleanUpdate.shippingCarrier, 60)
            : prevAddr.shippingCarrier;
        const tracking =
          cleanUpdate.trackingCode !== undefined
            ? sanitizeTextServer(cleanUpdate.trackingCode, 60).replace(/[^A-Za-z0-9._-]/g, '')
            : prevAddr.trackingCode;

        updatePayload.shippingAddress = {
          ...prevAddr,
          shippingCarrier: carrier,
          trackingCode: tracking,
          shippedAt:
            tracking || nextStatus === 'Đang giao'
              ? prevAddr.shippedAt || new Date().toISOString()
              : prevAddr.shippedAt,
        };
      }

      await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(updatePayload),
      });

      return res.status(200).json({
        success: true,
        orderId,
        updated: updatePayload,
      });
    }

    // ─── 3. DELETE ORDER (ANTI-IDOR OWNERSHIP CHECK) ──────────────────────────
    if (action === 'delete') {
      const orderId = sanitizeTextServer(rawBody.orderId, 80);
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'Missing orderId' });
      }

      const orderRes = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,userId`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
          },
        }
      );
      const rows = orderRes.ok ? await orderRes.json() : [];
      const existingOrder = Array.isArray(rows) ? rows[0] : null;
      if (!existingOrder) {
        return res.status(200).json({ success: true });
      }

      if (!authUser.isAdmin && String(existingOrder.userId) !== authUser.id) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden (Anti-IDOR): Bạn không có quyền xoá đơn hàng của người khác.',
        });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${authUser.accessToken || SUPABASE_KEY}`,
        },
      });

      return res.status(200).json({ success: true, deletedId: orderId });
    }

    return res.status(400).json({ success: false, error: 'Unsupported action' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err && err.message ? err.message : 'Internal server error',
    });
  }
};
