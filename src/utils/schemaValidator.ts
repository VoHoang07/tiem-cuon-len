/**
 * Strict Schema Validation (Anti-Mass-Assignment) & XSS Sanitization Engine
 * Synchronized across Client & Admin forms and API payloads.
 */

import {
  validateBase64ImageUpload,
  MAX_PROCESSED_DATA_URI_BYTES,
} from './fileUploadGuard';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Strips all HTML/Script tags, dangerous protocols (javascript:, data:text/html, vbscript:),
 * inline event handlers (onerror=, onload=), null bytes, and control characters.
 */
export function sanitizeText(input: unknown, maxLength: number = 200): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  try {
    str = str.normalize('NFC');
  } catch {
    // ignore normalize error
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
 * Sanitizes multi-line text (product descriptions, chat messages, reviews)
 * while preserving safe line breaks (\n).
 */
export function sanitizeMultilineText(input: unknown, maxLength: number = 2000): string {
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

export function sanitizeEmail(input: unknown): string {
  return sanitizeText(input, 120).toLowerCase();
}

export function sanitizePhone(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[^0-9+]/g, '')
    .slice(0, 15);
}

export function sanitizeSafeUrlOrImage(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed === '__COVER__') return '__COVER__';
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    const check = validateBase64ImageUpload(trimmed, MAX_PROCESSED_DATA_URI_BYTES);
    return check.valid ? trimmed : null;
  }
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(trimmed)) {
    return trimmed.slice(0, 2048);
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed.replace(/[<>'"`]/g, '').slice(0, 500);
  }
  return null;
}

/**
 * Anti-Mass-Assignment helper: extracts ONLY explicitly declared keys from an untrusted object,
 * discarding any extra fields (such as injected `role`, `isAdmin`, `status`, `price`, etc.).
 */
export function stripUnknownFields<T extends object>(
  raw: unknown,
  allowedKeys: readonly (keyof T)[]
): Partial<T> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const src = raw as Record<string, unknown>;
  const out: Partial<T> = {};
  for (const key of allowedKeys) {
    const k = String(key);
    if (Object.prototype.hasOwnProperty.call(src, k) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
      out[key] = src[k] as T[keyof T];
    }
  }
  return out;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VN_PHONE_REGEX = /^(?:\+?84|0)[35789][0-9]{8}$/;

// ─── 1. AUTH SCHEMAS ────────────────────────────────────────────────────────

export interface ValidatedLoginInput {
  email: string;
  password: string;
}

export function validateLoginSchema(raw: unknown): ValidationResult<ValidatedLoginInput> {
  const clean = stripUnknownFields<ValidatedLoginInput>(raw, ['email', 'password']);
  const email = sanitizeEmail(clean.email);
  const password = typeof clean.password === 'string' ? clean.password.slice(0, 128) : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    return { success: false, error: 'Email không hợp lệ.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  }
  return { success: true, data: { email, password } };
}

export interface ValidatedRegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegisterSchema(raw: unknown): ValidationResult<ValidatedRegisterInput> {
  const clean = stripUnknownFields<ValidatedRegisterInput>(raw, [
    'name',
    'email',
    'password',
    'confirmPassword',
  ]);
  const name = sanitizeText(clean.name, 80);
  const email = sanitizeEmail(clean.email);
  const password = typeof clean.password === 'string' ? clean.password.slice(0, 128) : '';
  const confirmPassword =
    typeof clean.confirmPassword === 'string' ? clean.confirmPassword.slice(0, 128) : '';

  if (!name || name.length < 2) {
    return { success: false, error: 'Họ tên phải có từ 2 đến 80 ký tự.' };
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return { success: false, error: 'Địa chỉ email không hợp lệ.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  }
  if (password !== confirmPassword) {
    return { success: false, error: 'Mật khẩu xác nhận không khớp.' };
  }

  return {
    success: true,
    data: { name, email, password, confirmPassword },
  };
}

// ─── 2. ADDRESS SCHEMA (ANTI-MASS-ASSIGNMENT) ───────────────────────────────

export interface ValidatedAddressInput {
  fullName: string;
  phone: string;
  city: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault: boolean;
}

export function validateAddressSchema(raw: unknown): ValidationResult<ValidatedAddressInput> {
  const clean = stripUnknownFields<ValidatedAddressInput>(raw, [
    'fullName',
    'phone',
    'city',
    'district',
    'ward',
    'detailAddress',
    'isDefault',
  ]);

  const fullName = sanitizeText(clean.fullName, 80);
  const phone = sanitizePhone(clean.phone);
  const city = sanitizeText(clean.city, 80);
  const district = sanitizeText(clean.district, 80);
  const ward = sanitizeText(clean.ward, 80);
  const detailAddress = sanitizeText(clean.detailAddress, 220);
  const isDefault = Boolean(clean.isDefault);

  if (!fullName || fullName.length < 2) {
    return { success: false, error: 'Họ tên người nhận phải có ít nhất 2 ký tự.' };
  }
  if (fullName.startsWith('__TCL_')) {
    return { success: false, error: 'Tên người nhận chứa tiền tố hệ thống không hợp lệ.' };
  }
  if (!phone || (!VN_PHONE_REGEX.test(phone) && phone.length < 9)) {
    return { success: false, error: 'Số điện thoại người nhận không hợp lệ (cần 10 chữ số).' };
  }
  if (!city) {
    return { success: false, error: 'Vui lòng chọn hoặc nhập Tỉnh/Thành phố.' };
  }
  if (!detailAddress || detailAddress.length < 3) {
    return { success: false, error: 'Vui lòng nhập số nhà, tên đường cụ thể.' };
  }

  return {
    success: true,
    data: {
      fullName,
      phone,
      city,
      district,
      ward,
      detailAddress,
      isDefault,
    },
  };
}

// ─── 3. REVIEW SCHEMA ───────────────────────────────────────────────────────

export interface ValidatedReviewInput {
  rating: number;
  comment: string;
  userName: string;
}

export function validateReviewSchema(raw: unknown): ValidationResult<ValidatedReviewInput> {
  const clean = stripUnknownFields<ValidatedReviewInput>(raw, ['rating', 'comment', 'userName']);
  const ratingNum = Math.round(Number(clean.rating) || 5);
  const rating = Math.max(1, Math.min(5, ratingNum));
  const comment = sanitizeMultilineText(clean.comment, 500);
  const userName = sanitizeText(clean.userName || 'Khách hàng', 80) || 'Khách hàng';

  if (!comment || comment.length < 2) {
    return { success: false, error: 'Nội dung đánh giá quá ngắn.' };
  }

  return {
    success: true,
    data: { rating, comment, userName },
  };
}

// ─── 4. PRODUCT STUDIO FORM SCHEMA (ADMIN) ──────────────────────────────────

export interface ValidatedProductFormInput {
  name: string;
  description: string;
  price: number;
  category: string;
  material: string;
  color: string;
  quantity: number;
  isMadeToOrder: boolean;
  tags: string[];
}

const ALLOWED_CATEGORIES = new Set([
  'VelvetWire',
  'Keychain',
  'Yarn',
  'Crochet',
  'Bags',
  'Dolls',
  'Accessories',
]);

export function validateProductFormSchema(
  raw: unknown
): ValidationResult<ValidatedProductFormInput> {
  const clean = stripUnknownFields<ValidatedProductFormInput>(raw, [
    'name',
    'description',
    'price',
    'category',
    'material',
    'color',
    'quantity',
    'isMadeToOrder',
    'tags',
  ]);

  const name = sanitizeText(clean.name, 140);
  const description = sanitizeMultilineText(clean.description, 4000);
  const price = Math.round(Number(clean.price) || 0);
  const categoryRaw = sanitizeText(clean.category, 40);
  const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : 'Crochet';
  const material = sanitizeText(clean.material, 120);
  const color = sanitizeText(clean.color, 120);
  const quantity = Math.max(0, Math.min(10000, Math.round(Number(clean.quantity) || 1)));
  const isMadeToOrder = clean.isMadeToOrder !== false;

  const rawTags = Array.isArray(clean.tags) ? clean.tags : [];
  const tags = rawTags
    .map((t) => sanitizeText(t, 40))
    .filter(Boolean)
    .slice(0, 15);

  if (!name || name.length < 2) {
    return { success: false, error: 'Tên sản phẩm phải có ít nhất 2 ký tự.' };
  }
  if (!Number.isFinite(price) || price < 1000 || price > 100_000_000) {
    return { success: false, error: 'Giá sản phẩm phải nằm trong khoảng 1.000₫ – 100.000.000₫.' };
  }

  return {
    success: true,
    data: {
      name,
      description,
      price,
      category,
      material,
      color,
      quantity,
      isMadeToOrder,
      tags,
    },
  };
}

// ─── 5. ORDER STATUS & SHIPPING UPDATE SCHEMA ───────────────────────────────

const ALLOWED_ORDER_STATUSES = new Set([
  'pending_payment',
  'Đang xử lý',
  'Đang chuẩn bị hàng',
  'Đang giao',
  'Hoàn thành',
  'Đã hủy',
]);

export function validateOrderShippingUpdateSchema(raw: unknown): ValidationResult<{
  orderId: string;
  status?: string;
  shippingCarrier?: string;
  trackingCode?: string;
}> {
  const clean = stripUnknownFields<{
    orderId: string;
    status?: string;
    shippingCarrier?: string;
    trackingCode?: string;
  }>(raw, ['orderId', 'status', 'shippingCarrier', 'trackingCode']);

  const orderId = sanitizeText(clean.orderId, 80);
  if (!orderId) {
    return { success: false, error: 'Mã đơn hàng không hợp lệ.' };
  }

  const status = clean.status ? sanitizeText(clean.status, 40) : undefined;
  if (status && !ALLOWED_ORDER_STATUSES.has(status)) {
    return { success: false, error: 'Trạng thái đơn hàng không hợp lệ.' };
  }

  const shippingCarrier =
    clean.shippingCarrier !== undefined
      ? sanitizeText(clean.shippingCarrier, 60)
      : undefined;
  const trackingCode =
    clean.trackingCode !== undefined
      ? sanitizeText(clean.trackingCode, 60).replace(/[^A-Za-z0-9._-]/g, '')
      : undefined;

  return {
    success: true,
    data: {
      orderId,
      status,
      shippingCarrier,
      trackingCode,
    },
  };
}
