const {
  SUPABASE_URL,
  SUPABASE_KEY,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  verifyCsrfRequest,
  verifySupabaseUser,
  calculateDynamicPairComboPriceServer,
  resolveComboSlotUnitPriceServer,
  resolveAuthoritativeProductPrices,
  resolveAuthoritativeShippingConfig,
  resolveAuthoritativePromoDiscount,
  issuePersonalMissionVoucherServer,
  markPersonalVoucherUsedServer,
  logServerAuditEvent,
  withGlobalErrorHandler,
  sendOrderNotificationServer,
  sendCustomerOrderLifecycleEmailServer,
  } = require('./_securityCore');

const ALLOWED_STATUSES = new Set([
  'pending_payment',
  'Đang xử lý',
  'Đang chuẩn bị hàng',
  'Đang giao',
  'Hoàn thành',
  'Đã hủy',
]);

module.exports = withGlobalErrorHandler('/api/orders-guard', async function handler(req, res) {
  const csrf = verifyCsrfRequest(req);
  if (!csrf.valid) {
    return res.status(403).json({
      success: false,
      error: 'Yêu cầu bị từ chối do không hợp lệ (CSRF Guard).',
    });
  }

  const authUser = await verifySupabaseUser(req);

  // ─── GET ORDER BY ID (WITH ANTI-IDOR OWNERSHIP CHECK) ───────────────────────
  if (req.method === 'GET') {
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Vui lòng đăng nhập lại.',
      });
    }
    const orderId = sanitizeTextServer((req.query && req.query.orderId) || '', 80);
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng (orderId).' });
    }

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
      await logServerAuditEvent(req, {
        eventType: 'ADMIN_SECURITY_ACTION',
        severity: 'WARNING',
        path: '/api/orders-guard',
        userEmail: authUser.email,
        userId: authUser.id,
        details: {
          reason: 'ANTI_IDOR_ORDER_READ_BLOCKED',
          attemptedOrderId: orderId,
        },
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden (Anti-IDOR): Bạn không có quyền xem đơn hàng của người khác.',
      });
    }

    return res.status(200).json({ success: true, order });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const rawBody =
    typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : req.body || {};

  const action = sanitizeTextServer(rawBody.action || 'create', 30);

  if (!authUser && action !== 'notify_email') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Vui lòng đăng nhập lại.',
    });
  }

  // ─── 0A. ADMIN ISSUE PERSONAL 1-TO-1 MISSION VOUCHER (`VD25-` / `FB15-`) ───
  if (action === 'issue_personal_voucher') {
    if (!authUser || !authUser.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Chỉ Quản trị viên mới có quyền duyệt và cấp mã thưởng riêng.',
      });
    }
    const cleanIssue = stripUnknownFieldsServer(rawBody, [
      'missionType',
      'targetUserId',
      'targetEmail',
      'targetCustomerName',
      'targetOrderId',
    ]);
    const issued = await issuePersonalMissionVoucherServer({
      missionType: sanitizeTextServer(cleanIssue.missionType, 40),
      targetUserId: sanitizeTextServer(cleanIssue.targetUserId, 80),
      targetEmail: sanitizeTextServer(cleanIssue.targetEmail, 120),
      targetCustomerName: sanitizeTextServer(cleanIssue.targetCustomerName, 80),
      targetOrderId: sanitizeTextServer(cleanIssue.targetOrderId, 80),
      issuedByEmail: authUser.email,
      adminAccessToken: authUser.accessToken,
    });
    if (!issued.ok) {
      return res.status(400).json({ success: false, error: issued.error });
    }
    return res.status(200).json({ success: true, voucher: issued.voucher });
  }

  // ─── 0B. VALIDATE VOUCHER CODE FOR LOGGED-IN CUSTOMER BEFORE CHECKOUT ──────
  if (action === 'validate_voucher') {
    const cleanCheck = stripUnknownFieldsServer(rawBody, [
      'promoCode',
      'eligibleRetailSubtotal',
      'phone',
      'email',
    ]);
    const code = sanitizeTextServer(cleanCheck.promoCode, 40);
    const retailSub = Math.max(0, Number(cleanCheck.eligibleRetailSubtotal) || 0);
    const evalRes = await resolveAuthoritativePromoDiscount(code, retailSub, {
      userId: authUser.id,
      email: sanitizeTextServer(cleanCheck.email || authUser.email || '', 120),
      phone: sanitizeTextServer(cleanCheck.phone || '', 24),
    });
    return res.status(200).json({
      success: true,
      valid: Boolean(evalRes.promoCode && evalRes.discountAmount > 0),
      promoCode: evalRes.promoCode || '',
      discountAmount: evalRes.discountAmount || 0,
      title: evalRes.title || '',
      error: evalRes.error || '',
    });
  }

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

    const rawShipAddrPreview =
      cleanOrder.shippingAddress && typeof cleanOrder.shippingAddress === 'object'
        ? cleanOrder.shippingAddress
        : {};

    const baseIdsSet = new Set();
    for (const it of rawItems) {
      const p = (it && it.product) || {};
      const bid = String(p.baseProductId || p.id || '').split('__')[0];
      if (bid) baseIdsSet.add(bid);
      if (p.comboSlot1Id) {
        const s1Prod = String(p.comboSlot1Id).split('__')[0];
        if (s1Prod) baseIdsSet.add(s1Prod);
      }
      if (p.comboSlot2Id) {
        const s2Prod = String(p.comboSlot2Id).split('__')[0];
        if (s2Prod) baseIdsSet.add(s2Prod);
      }
    }
    if (rawShipAddrPreview.bonusGiftProductId) {
      const gBase = String(rawShipAddrPreview.bonusGiftProductId).split('__')[0];
      if (gBase && !gBase.startsWith('gift_35k_')) {
        baseIdsSet.add(gBase);
      }
    }
    const baseIds = Array.from(baseIdsSet);
    const [priceMap, shippingCfg] = await Promise.all([
      resolveAuthoritativeProductPrices(baseIds),
      resolveAuthoritativeShippingConfig(),
    ]);

    let authoritativeSubtotal = 0;
    let eligibleRetailSubtotal = 0;
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
        'selectedAccessoryId',
        'selectedAccessoryName',
        'selectedAccessoryEmoji',
        'comboSlot1Id',
        'comboSlot2Id',
        'giftCardNote',
      ]);

      const baseId = String(rawProd.baseProductId || rawProd.id || '').split('__')[0];
      const rawIdParts = String(rawProd.id || '').split('__');
      const selectedColorIdCandidate = String(
        rawProd.selectedColorId || (rawIdParts.length >= 2 ? rawIdParts[1] : '')
      ).trim();
      const selectedColorNameCandidate = String(
        rawProd.selectedColorName || rawProd.color || ''
      )
        .trim()
        .toLowerCase();
      const selectedAccIdCandidate = String(
        rawProd.selectedAccessoryId || (rawIdParts.length >= 3 ? rawIdParts[2] : '')
      ).trim();
      const isGiftBoxOption =
        selectedAccIdCandidate === 'gift_box_letter' ||
        String(rawProd.selectedAccessoryName || '')
          .toLowerCase()
          .includes('hộp quà') ||
        String(rawProd.selectedAccessoryName || '')
          .toLowerCase()
          .includes('quà tặng') ||
        String(rawProd.name || '')
          .toLowerCase()
          .includes('hộp quà') ||
        String(rawProd.name || '')
          .toLowerCase()
          .includes('quà tặng');
      const accessoryDelta = isGiftBoxOption ? 25000 : 0;
      const qty = Math.max(1, Math.min(99, Math.round(Number(it.quantity) || 1)));

      const cleanSlot1 = rawProd.comboSlot1Id
        ? sanitizeTextServer(rawProd.comboSlot1Id, 90)
        : '';
      const cleanSlot2 = rawProd.comboSlot2Id
        ? sanitizeTextServer(rawProd.comboSlot2Id, 90)
        : '';

      const isComboLineItem =
        baseId.startsWith('combo_') ||
        selectedColorIdCandidate === 'c_combo_2' ||
        selectedColorIdCandidate.startsWith('pkg_') ||
        Boolean(cleanSlot1 || cleanSlot2) ||
        selectedColorNameCandidate.includes('combo');

      let dynamicComboUnitPrice = 0;
      if (isComboLineItem && cleanSlot1 && cleanSlot2) {
        const s1Unit = resolveComboSlotUnitPriceServer(cleanSlot1, priceMap);
        const s2Unit = resolveComboSlotUnitPriceServer(cleanSlot2, priceMap);
        if (s1Unit > 0 && s2Unit > 0) {
          dynamicComboUnitPrice = calculateDynamicPairComboPriceServer(s1Unit, s2Unit);
        }
      }

      // RED TEAM FIX: Never fall back to client-supplied `rawProd.price`!
      const baseServerUnitPrice =
        dynamicComboUnitPrice > 0
          ? dynamicComboUnitPrice
          : (selectedColorIdCandidate &&
              priceMap.get(`${baseId}__${selectedColorIdCandidate}`)) ||
            (selectedColorNameCandidate &&
              priceMap.get(`${baseId}__name:${selectedColorNameCandidate}`)) ||
            priceMap.get(baseId);
      if (!baseId || typeof baseServerUnitPrice !== 'number' || baseServerUnitPrice <= 0) {
        await logServerAuditEvent(req, {
          eventType: 'ADMIN_SECURITY_ACTION',
          severity: 'CRITICAL',
          path: '/api/orders-guard',
          userEmail: authUser.email,
          userId: authUser.id,
          details: {
            reason: 'UNKNOWN_OR_TAMPERED_PRODUCT_ID',
            baseId,
            clientClaimedPrice: rawProd.price,
          },
        });
        return res.status(400).json({
          success: false,
          error: `Sản phẩm không tồn tại hoặc dữ liệu giá không hợp lệ (${baseId}).`,
        });
      }

      const serverUnitPrice = baseServerUnitPrice + accessoryDelta;
      const lineTotal = serverUnitPrice * qty;
      authoritativeSubtotal += lineTotal;
      if (!isComboLineItem) {
        eligibleRetailSubtotal += lineTotal;
      }

      sanitizedItems.push({
        product: {
          id: sanitizeTextServer(rawProd.id || baseId, 140),
          baseProductId: sanitizeTextServer(baseId, 80),
          name: sanitizeTextServer(rawProd.name, 160),
          category: sanitizeTextServer(rawProd.category || 'Crochet', 40),
          material: sanitizeTextServer(rawProd.material || '', 120),
          color: sanitizeTextServer(rawProd.color || '', 90),
          image: typeof rawProd.image === 'string' ? rawProd.image : null,
          price: serverUnitPrice,
          isMadeToOrder: rawProd.isMadeToOrder !== false,
          selectedColorId: rawProd.selectedColorId
            ? sanitizeTextServer(rawProd.selectedColorId, 60)
            : undefined,
          selectedColorName: rawProd.selectedColorName
            ? sanitizeTextServer(rawProd.selectedColorName, 90)
            : undefined,
          selectedColorHex: rawProd.selectedColorHex
            ? sanitizeTextServer(rawProd.selectedColorHex, 20)
            : undefined,
          selectedAccessoryId: isGiftBoxOption ? 'gift_box_letter' : 'no_box',
          selectedAccessoryName: isGiftBoxOption
            ? 'Set Quà Tặng Đặc Biệt (+25.000₫)'
            : 'Tự dùng / Tiêu chuẩn',
          comboSlot1Id: cleanSlot1 || undefined,
          comboSlot2Id: cleanSlot2 || undefined,
          giftCardNote:
            isGiftBoxOption && rawProd.giftCardNote
              ? sanitizeTextServer(rawProd.giftCardNote, 300)
              : undefined,
          },
          quantity: qty,
          price: serverUnitPrice,
          });
          }

          if (sanitizedItems.length === 0) {
          return res.status(400).json({
          success: false,
          error: 'Đơn hàng phải có ít nhất 1 sản phẩm hợp lệ.',
          });
          }

          // Sanitize shipping address & compute authoritative shipping fee using server config
          const rawAddr = stripUnknownFieldsServer(cleanOrder.shippingAddress, [
          'id',
          'fullName',
          'phone',
          'email',
          'city',
          'district',
          'ward',
          'detailAddress',
          'shippingMethod',
          'shippingFee',
          'note',
          'promoCode',
          'discountAmount',
          'bonusGiftProductId',
          'bonusGiftProductName',
          'bonusGiftValue',
          'customerAuthProvider',
          'isVerifiedAccount',
          ]);

    const city = sanitizeTextServer(rawAddr.city, 80);
    const cleanPhone = sanitizeTextServer(rawAddr.phone, 20)
      .replace(/[\s.\-()]/g, '')
      .replace(/^\+?84/, '0');
    const validPrefixes = /^(03[2-9]|05[25689]|07[06-9]|08[1-689]|09[0-46-9])\d{7}$/;
    const isRepeatingDigits = /(\d)\1{4,}/.test(cleanPhone);
    const isSequentialDigits = /(012345|123456|234567|345678|456789|987654|876543|765432|654321|543210)/.test(
      cleanPhone
    );
    if (!validPrefixes.test(cleanPhone) || isRepeatingDigits || isSequentialDigits) {
      return res.status(400).json({
        success: false,
        error:
          'Số điện thoại nhận hàng chưa chính xác (cần đúng 10 số nhà mạng Viettel, Vina, Mobi...). Bạn yên tâm nhập SĐT thật để Shipper gọi giao hàng nhé!',
      });
    }
    const shippingMethod = sanitizeTextServer(rawAddr.shippingMethod || '', 120);
    const shippingLower = shippingMethod.toLowerCase();
    const isPickupOrExpress =
      shippingLower.includes('ghé tiệm') ||
      shippingLower.includes('nhận tại tiệm') ||
      shippingLower.includes('trong ngày') ||
      shippingLower.includes('hỏa tốc');
    const isHcm =
      city.toLowerCase().includes('hồ chí minh') ||
      city.toLowerCase().includes('ho chi minh') ||
      city.toLowerCase().includes('hcm') ||
      city.toLowerCase().includes('sài gòn');

    let authoritativeShippingFee = 0;
    if (!isPickupOrExpress) {
      if (
        shippingCfg.freeshipEnabled !== false &&
        shippingCfg.freeshipThreshold > 0 &&
        authoritativeSubtotal >= shippingCfg.freeshipThreshold
      ) {
        authoritativeShippingFee = 0;
      } else {
        authoritativeShippingFee = isHcm ? shippingCfg.hcmFee : shippingCfg.provincialFee;
      }
    }

    const rawCustEmailForPromo = sanitizeTextServer(
      rawAddr.email || authUser.email || '',
      120
    )
      .trim()
      .toLowerCase();

    const promoResult = await resolveAuthoritativePromoDiscount(
      rawAddr.promoCode,
      eligibleRetailSubtotal,
      {
        userId: authUser.id,
        email: rawCustEmailForPromo,
        phone: cleanPhone,
      }
    );
    const authoritativeDiscount = promoResult.discountAmount || 0;

    // Authoritative 35k Bonus Gift Verification (ONLY granted when a valid `VD25-XXXXXX` code is redeemed,
    // and strictly capped at <= 39.000₫ server catalog price so no expensive item can ever be injected as a free gift!)
    let verifiedBonusGiftId;
    let verifiedBonusGiftName;
    let verifiedBonusGiftValue;
    if (promoResult.promoCode && promoResult.promoCode.startsWith('VD25-')) {
      const candidateGiftId = sanitizeTextServer(
        rawAddr.bonusGiftProductId || '',
        90
      );
      const candidateGiftName = sanitizeTextServer(
        rawAddr.bonusGiftProductName || '',
        120
      );
      if (candidateGiftId.startsWith('gift_35k_')) {
        verifiedBonusGiftId = candidateGiftId;
        verifiedBonusGiftName =
          candidateGiftName || 'Sản phẩm quà tặng 35.000₫ của Tiệm';
        verifiedBonusGiftValue = 35000;
      } else if (candidateGiftId) {
        const [gBase, gVar] = candidateGiftId.split('__');
        const gPrice =
          (gVar && gVar !== 'main' && priceMap.get(`${gBase}__${gVar}`)) ||
          priceMap.get(gBase);
        if (typeof gPrice === 'number' && gPrice > 0 && gPrice <= 39000) {
          verifiedBonusGiftId = candidateGiftId;
          verifiedBonusGiftName =
            candidateGiftName || `Sản phẩm quà tặng (${gBase})`;
          verifiedBonusGiftValue = gPrice;
        } else {
          verifiedBonusGiftId = 'gift_35k_shop_default';
          verifiedBonusGiftName = '01 Móc khóa / Kẹp tóc 35.000₫ của Tiệm';
          verifiedBonusGiftValue = 35000;
        }
      } else {
        verifiedBonusGiftId = 'gift_35k_shop_default';
        verifiedBonusGiftName = '01 Móc khóa / Kẹp tóc 35.000₫ của Tiệm';
        verifiedBonusGiftValue = 35000;
      }
    }
    const authoritativeTotal = Math.max(
      0,
      authoritativeSubtotal - authoritativeDiscount + authoritativeShippingFee
    );
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

    const rawCustEmail = sanitizeTextServer(
      rawAddr.email || authUser.email || '',
      120
    )
      .trim()
      .toLowerCase();
    const resolvedCustEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawCustEmail) &&
      !rawCustEmail.endsWith('@guest.tiemcuonlen.vn') &&
      !rawCustEmail.endsWith('@phone.tiemcuonlen.vn')
        ? rawCustEmail
        : undefined;

    const finalOrder = {
      id: orderId,
      userId: authUser.id, // Enforced from verified JWT (Anti-IDOR)
      items: sanitizedItems,
      total: authoritativeTotal,
      shippingAddress: {
        id: sanitizeTextServer(rawAddr.id || `addr_${Date.now()}`, 60),
        userId: authUser.id,
        fullName: sanitizeTextServer(rawAddr.fullName, 80),
        phone: cleanPhone,
        email: resolvedCustEmail,
        city,
        district: sanitizeTextServer(rawAddr.district, 80),
        ward: sanitizeTextServer(rawAddr.ward, 80),
        detailAddress: sanitizeTextServer(rawAddr.detailAddress, 220),
        shippingMethod,
        shippingFee: authoritativeShippingFee,
        note: rawAddr.note ? sanitizeTextServer(rawAddr.note, 500) : undefined,
        promoCode: promoResult.promoCode || undefined,
        discountAmount: authoritativeDiscount > 0 ? authoritativeDiscount : undefined,
        bonusGiftProductId: verifiedBonusGiftId,
        bonusGiftProductName: verifiedBonusGiftName,
        bonusGiftValue: verifiedBonusGiftValue,
        customerAuthProvider: sanitizeTextServer(
          rawAddr.customerAuthProvider ||
            (resolvedCustEmail ? 'gmail_verified' : 'guest'),
          30
        ),
        isVerifiedAccount: Boolean(
          rawAddr.isVerifiedAccount || resolvedCustEmail
        ),
        emailNotifiedAt: isCod ? new Date().toISOString() : undefined,
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

    // Burn personal 1-to-1 voucher (`VD25-` / `FB15-`) immediately for COD, or defer until payment is confirmed for QR
    if (isCod && promoResult.isPersonalVoucher && promoResult.promoCode) {
      await markPersonalVoucherUsedServer(
        promoResult.promoCode,
        orderId,
        authUser.accessToken
      );
    }

    // Dispatch EmailJS notification server-side (keeps EmailJS keys off client bundle)
    if (isCod) {
      await sendOrderNotificationServer(finalOrder);
    }

    return res.status(200).json({
      success: true,
      order: finalOrder,
    });
  }

  // ─── 2. NOTIFY EMAIL FOR CONFIRMED ORDER (SERVER-SIDE EMAILJS DISPATCH) ───
  if (action === 'notify_email') {
    const orderId = sanitizeTextServer(rawBody.orderId, 80);
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng.' });
    }

    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${(authUser && authUser.accessToken) || SUPABASE_KEY}`,
        },
      }
    );
    const rows = orderRes.ok ? await orderRes.json() : [];
    const existingOrder = Array.isArray(rows) ? rows[0] : null;
    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng.' });
    }

    if (authUser && !authUser.isAdmin && String(existingOrder.userId) !== authUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden (Anti-IDOR).' });
    }
    if (!authUser && existingOrder.status === 'pending_payment') {
      return res.status(200).json({
        success: true,
        sent: false,
        reason: 'Order still awaiting payment',
      });
    }

    // Persistent Idempotency Check: never send duplicate email if already notified
    if (
      existingOrder.shippingAddress &&
      existingOrder.shippingAddress.emailNotifiedAt
    ) {
      return res.status(200).json({
        success: true,
        sent: true,
        deduplicated: true,
      });
    }

    const updatedAddr = {
      ...(existingOrder.shippingAddress || {}),
      emailNotifiedAt: new Date().toISOString(),
    };
    await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${(authUser && authUser.accessToken) || SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ shippingAddress: updatedAddr }),
      }
    );

    const sent = await sendOrderNotificationServer({
      ...existingOrder,
      shippingAddress: updatedAddr,
    });
    if (existingOrder.shippingAddress && existingOrder.shippingAddress.promoCode) {
      await markPersonalVoucherUsedServer(
        existingOrder.shippingAddress.promoCode,
        orderId,
        authUser && authUser.accessToken
      );
    }
    return res.status(200).json({ success: true, sent });
  }

  // ─── 3. UPDATE ORDER STATUS / SHIPPING (ADMIN OR OWNER CANCEL ONLY) ───────
  if (action === 'update_status' || action === 'update_shipping') {
    const cleanUpdate = stripUnknownFieldsServer(rawBody, [
      'orderId',
      'status',
      'shippingCarrier',
      'trackingCode',
    ]);

    const orderId = sanitizeTextServer(cleanUpdate.orderId, 80);
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng.' });
    }

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
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng.' });
    }

    const nextStatus = cleanUpdate.status
      ? sanitizeTextServer(cleanUpdate.status, 40)
      : existingOrder.status;

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return res.status(400).json({ success: false, error: 'Trạng thái đơn hàng không hợp lệ.' });
    }

    if (!authUser.isAdmin) {
      const isOwner = String(existingOrder.userId) === authUser.id;
      const isCustomerCancelAllowed =
        isOwner &&
        nextStatus === 'Đã hủy' &&
        (existingOrder.status === 'pending_payment' || existingOrder.status === 'Đang xử lý');
      const isCustomerCompleteAllowed =
        isOwner &&
        nextStatus === 'Hoàn thành' &&
        existingOrder.status === 'Đang giao';

      if (!isCustomerCancelAllowed && !isCustomerCompleteAllowed) {
        await logServerAuditEvent(req, {
          eventType: 'ADMIN_SECURITY_ACTION',
          severity: 'WARNING',
          path: '/api/orders-guard',
          userEmail: authUser.email,
          userId: authUser.id,
          details: {
            reason: 'UNAUTHORIZED_STATUS_UPDATE_ATTEMPT',
            orderId,
            attemptedStatus: nextStatus,
          },
        });
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

    // Automatically notify the customer by Email when order is Shipped or Completed
    if (authUser.isAdmin) {
      if (
        existingOrder.status === 'pending_payment' &&
        nextStatus !== 'pending_payment' &&
        nextStatus !== 'Đã hủy' &&
        existingOrder.shippingAddress &&
        existingOrder.shippingAddress.promoCode
      ) {
        await markPersonalVoucherUsedServer(
          existingOrder.shippingAddress.promoCode,
          orderId,
          authUser.accessToken
        );
      }
      const mergedOrder = {
        ...existingOrder,
        status: nextStatus,
        shippingAddress:
          updatePayload.shippingAddress || existingOrder.shippingAddress,
      };
      const prevTracking =
        (existingOrder.shippingAddress &&
          existingOrder.shippingAddress.trackingCode) ||
        '';
      const newTracking =
        (mergedOrder.shippingAddress &&
          mergedOrder.shippingAddress.trackingCode) ||
        '';

      if (
        authUser.isAdmin &&
        ((nextStatus === 'Đang giao' && existingOrder.status !== 'Đang giao') ||
          (newTracking && newTracking !== prevTracking))
      ) {
        await sendCustomerOrderLifecycleEmailServer(mergedOrder, 'shipped');
      } else if (
        nextStatus === 'Hoàn thành' &&
        existingOrder.status !== 'Hoàn thành'
      ) {
        await sendCustomerOrderLifecycleEmailServer(mergedOrder, 'completed');
      }
      } else if (
      nextStatus === 'Hoàn thành' &&
      existingOrder.status !== 'Hoàn thành'
      ) {
      await sendCustomerOrderLifecycleEmailServer(
        { ...existingOrder, status: nextStatus },
        'completed'
      );
      }

    return res.status(200).json({
      success: true,
      orderId,
      updated: updatePayload,
    });
  }

  // ─── 4. DELETE ORDER (ANTI-IDOR OWNERSHIP CHECK) ──────────────────────────
  if (action === 'delete') {
    const orderId = sanitizeTextServer(rawBody.orderId, 80);
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng.' });
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
});
