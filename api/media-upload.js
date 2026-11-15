const crypto = require('crypto');
const {
  ADMIN_EMAILS,
  extractClientTelemetry,
  sanitizeTextServer,
  stripUnknownFieldsServer,
  verifyCsrfRequest,
  isIpBlockedOnServer,
  verifySupabaseUser,
  logServerAuditEvent,
  withGlobalErrorHandler,
} = require('./_securityCore');

// Sliding-window rate limit per IP for media uploads
const uploadRateWindows = new Map();
const UPLOAD_WINDOW_MS = 60 * 1000;
const MAX_CUSTOMER_UPLOADS_PER_MIN = 12;
const MAX_ADMIN_UPLOADS_PER_MIN = 80;

// Maximum binary sizes per upload purpose
const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB processed WebP/JPEG
const MAX_PROOF_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB screenshot

function checkUploadRateLimit(ip, isAdmin) {
  const now = Date.now();
  const key = `${isAdmin ? 'adm' : 'usr'}:${ip || 'unknown'}`;
  const maxAllowed = isAdmin ? MAX_ADMIN_UPLOADS_PER_MIN : MAX_CUSTOMER_UPLOADS_PER_MIN;
  const entry = uploadRateWindows.get(key) || { ts: [] };
  entry.ts = entry.ts.filter((t) => now - t < UPLOAD_WINDOW_MS);
  entry.ts.push(now);
  uploadRateWindows.set(key, entry);
  if (uploadRateWindows.size > 1500) {
    const oldest = uploadRateWindows.keys().next().value;
    if (oldest) uploadRateWindows.delete(oldest);
  }
  return entry.ts.length <= maxAllowed;
}

/**
 * Verifies Admin identity via either:
 * 1. Supabase JWT (`verifySupabaseUser`)
 * 2. Verified Google OAuth access_token / id_token when GoTrue session is syncing
 */
async function verifyAdminOrOAuthCaller(req, oauthTokenRaw, oauthProviderRaw) {
  const sbUser = await verifySupabaseUser(req);
  if (sbUser) {
    return sbUser;
  }

  const cleanToken = sanitizeTextServer(oauthTokenRaw || '', 2500);
  const provider = sanitizeTextServer(oauthProviderRaw || '', 20).toLowerCase();
  if (!cleanToken || cleanToken.length < 20) {
    return null;
  }

  try {
    if (provider === 'google') {
      const isJwt = cleanToken.split('.').length === 3;
      const url = isJwt
        ? `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`
        : 'https://www.googleapis.com/oauth2/v3/userinfo';
      const res = await fetch(
        url,
        isJwt
          ? { method: 'GET' }
          : {
              method: 'GET',
              headers: { Authorization: `Bearer ${cleanToken}` },
            }
      );
      if (!res.ok) return null;
      const profile = await res.json();
      const email = String(profile && profile.email ? profile.email : '')
        .toLowerCase()
        .trim();
      if (
        !email ||
        profile.email_verified === false ||
        profile.email_verified === 'false'
      ) {
        return null;
      }
      return {
        id: `google_${String(profile.sub || 'user')}`,
        email,
        isAdmin: ADMIN_EMAILS.has(email),
      };
    }

    if (provider === 'facebook') {
      const res = await fetch(
        `https://graph.facebook.com/me?fields=id,email&access_token=${encodeURIComponent(
          cleanToken
        )}`
      );
      if (!res.ok) return null;
      const profile = await res.json();
      if (!profile || !profile.id) return null;
      const email = String(profile.email || `fb_${profile.id}@facebook.tiemcuonlen.shop`)
        .toLowerCase()
        .trim();
      return {
        id: `facebook_${String(profile.id)}`,
        email,
        isAdmin: ADMIN_EMAILS.has(email),
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Inspects binary Magic Bytes on the Server and rejects polyglot scripts/HTML/SVG/PHP.
 */
function inspectImageMagicBytesServer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, reason: 'Dữ liệu ảnh quá nhỏ hoặc rỗng.' };
  }

  // Scan initial 512 bytes for executable/polyglot HTML/SVG/Script signatures
  const previewLen = Math.min(buffer.length, 512);
  let ascii = '';
  for (let i = 0; i < previewLen; i++) {
    const c = buffer[i];
    ascii += c >= 32 && c <= 126 ? String.fromCharCode(c) : ' ';
  }
  const lower = ascii.toLowerCase();
  if (
    lower.includes('<script') ||
    lower.includes('<svg') ||
    lower.includes('<?php') ||
    lower.includes('<!doctype html') ||
    lower.includes('<html') ||
    lower.includes('javascript:')
  ) {
    return {
      valid: false,
      reason: 'Phát hiện mã thực thi (Script/SVG/HTML) ẩn trong tệp tải lên.',
    };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // GIF: GIF87a / GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { valid: true, mime: 'image/gif', ext: 'gif' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  // AVIF / HEIF: ....ftyp(avif|avis|mif1|heic|heix)
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    const brand = buffer.slice(8, 12).toString('ascii').toLowerCase();
    if (
      brand === 'avif' ||
      brand === 'avis' ||
      brand === 'mif1' ||
      brand === 'heic' ||
      brand === 'heix'
    ) {
      return { valid: true, mime: 'image/avif', ext: 'avif' };
    }
  }

  return {
    valid: false,
    reason: 'Định dạng tệp không hợp lệ (Magic Bytes không khớp JPEG/PNG/WebP/GIF/AVIF).',
  };
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeRfc3986Path(objectKey) {
  return String(objectKey)
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
      )
    )
    .join('/');
}

/**
 * Uploads a binary Buffer directly to Cloudflare R2 via S3-compatible AWS Signature V4
 * using zero external SDK dependencies.
 */
async function putObjectToCloudflareR2({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  bodyBuffer,
  contentType,
  cacheControl,
}) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeRfc3986Path(bucketName)}/${encodeRfc3986Path(objectKey)}`;
  const endpointUrl = `https://${host}${canonicalUri}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = sha256Hex(bodyBuffer);

  const canonicalHeaders =
    `cache-control:${cacheControl}\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders =
    'cache-control;content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const putRes = await fetch(endpointUrl, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Cache-Control': cacheControl,
      'Content-Type': contentType,
      'Content-Length': String(bodyBuffer.length),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: bodyBuffer,
  });

  if (!putRes.ok) {
    const errBody = await putRes.text().catch(() => '');
    throw new Error(`R2 PUT HTTP ${putRes.status}: ${errBody.slice(0, 180)}`);
  }
}

module.exports = withGlobalErrorHandler(
  '/api/media-upload',
  async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
      });
    }

    const csrf = verifyCsrfRequest(req);
    if (!csrf.valid) {
      return res.status(403).json({
        success: false,
        error: 'Yêu cầu tải ảnh bị từ chối (CSRF Guard).',
      });
    }

    const telemetry = extractClientTelemetry(req);
    if (await isIpBlockedOnServer(telemetry.ip)) {
      return res.status(403).json({
        success: false,
        error: 'Địa chỉ IP hiện tại đã bị tạm khóa.',
      });
    }

    const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucketName = (process.env.R2_BUCKET_NAME || 'tiemcuonlen-media').trim();
    const publicBaseUrl = (
      process.env.R2_PUBLIC_BASE_URL || 'https://media.tiemcuonlen.shop'
    )
      .trim()
      .replace(/\/+$/, '');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return res.status(503).json({
        success: false,
        error: 'Kho lưu trữ ảnh đám mây R2 chưa được cấu hình đầy đủ trên máy chủ.',
      });
    }

    const rawBody =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};

    const cleanBody = stripUnknownFieldsServer(rawBody, [
      'purpose',
      'dataUri',
      'orderId',
      'productId',
      'oauthToken',
      'oauthProvider',
    ]);

    const purpose = sanitizeTextServer(cleanBody.purpose || 'product', 24).toLowerCase();
    if (purpose !== 'product' && purpose !== 'voucher_proof') {
      return res.status(400).json({
        success: false,
        error: 'Mục đích tải ảnh không hợp lệ.',
      });
    }

    const caller = await verifyAdminOrOAuthCaller(
      req,
      cleanBody.oauthToken,
      cleanBody.oauthProvider
    );

    if (purpose === 'product') {
      if (!caller || !caller.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Chỉ Quản trị viên Tiệm Cuộn Len mới có quyền đăng tải ảnh sản phẩm.',
        });
      }
    } else if (!caller) {
      return res.status(401).json({
        success: false,
        error: 'Vui lòng đăng nhập tài khoản để gửi ảnh minh chứng nhận quà nhé!',
      });
    }

    const isAdmin = Boolean(caller && caller.isAdmin);
    if (!checkUploadRateLimit(telemetry.ip, isAdmin)) {
      return res.status(429).json({
        success: false,
        error: 'Bạn đang tải ảnh quá nhanh. Vui lòng đợi ít giây rồi thử lại nhé!',
      });
    }

    const rawDataUri = typeof cleanBody.dataUri === 'string' ? cleanBody.dataUri.trim() : '';
    if (!rawDataUri) {
      return res.status(400).json({
        success: false,
        error: 'Không nhận được dữ liệu ảnh cần tải lên.',
      });
    }

    const commaIdx = rawDataUri.indexOf(',');
    const base64Payload = (commaIdx >= 0 ? rawDataUri.slice(commaIdx + 1) : rawDataUri).replace(
      /\s+/g,
      ''
    );

    const maxBytes =
      purpose === 'product' ? MAX_PRODUCT_IMAGE_BYTES : MAX_PROOF_IMAGE_BYTES;
    const estimatedBytes = Math.floor((base64Payload.length * 3) / 4);
    if (estimatedBytes < 16 || estimatedBytes > maxBytes) {
      return res.status(413).json({
        success: false,
        error: `Dung lượng ảnh vượt quá giới hạn cho phép (${(
          maxBytes /
          (1024 * 1024)
        ).toFixed(1)} MB).`,
      });
    }

    const binaryBuffer = Buffer.from(base64Payload, 'base64');
    if (binaryBuffer.length < 16 || binaryBuffer.length > maxBytes) {
      return res.status(413).json({
        success: false,
        error: 'Kích thước ảnh sau giải mã không hợp lệ.',
      });
    }

    const magic = inspectImageMagicBytesServer(binaryBuffer);
    if (!magic.valid || !magic.mime || !magic.ext) {
      await logServerAuditEvent(req, {
        eventType: 'MEDIA_UPLOAD_REJECTED',
        severity: 'CRITICAL',
        userEmail: caller ? caller.email : 'anonymous',
        userId: caller ? caller.id : null,
        details: {
          purpose,
          reason: magic.reason || 'INVALID_MAGIC_BYTES',
        },
      });
      return res.status(400).json({
        success: false,
        error: magic.reason || 'Định dạng tệp ảnh không hợp lệ.',
      });
    }

    const uuid =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex');

    const folder = purpose === 'product' ? 'products' : 'proofs';
    const objectKey = `${folder}/${uuid}.${magic.ext}`;
    const cacheControl = 'public, max-age=31536000, immutable';

    await putObjectToCloudflareR2({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      objectKey,
      bodyBuffer: binaryBuffer,
      contentType: magic.mime,
      cacheControl,
    });

    const publicUrl = `${publicBaseUrl}/${objectKey}`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      key: objectKey,
      mime: magic.mime,
      bytes: binaryBuffer.length,
    });
  }
);
