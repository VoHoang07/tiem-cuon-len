import { supabase } from '@/services/supabase';
import { Product } from '@/types/product';

export interface PromoVoucher {
  code: string;
  title: string;
  badge: string;
  description: string;
  discountAmount: number;
  minOrderSubtotal: number;
  active: boolean;
  newCustomerOnly?: boolean;
  singleUsePerUser?: boolean;
  isPersonalMission?: boolean;
  grantsFreeGiftMaxPrice?: number;
  profitSafeNote: string;
}

export interface BonusGiftChoice {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  displayLabel: string;
  originalPrice: number;
  image: string | null;
}

const SELECTED_BONUS_GIFT_KEY = 'tcl_selected_vd25_bonus_gift_v1';
export const VD25_BONUS_GIFT_MAX_PRICE = 39000;

export function getSelectedBonusGiftId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(SELECTED_BONUS_GIFT_KEY) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

export function setSelectedBonusGiftId(giftId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (giftId) {
        window.localStorage.setItem(SELECTED_BONUS_GIFT_KEY, giftId);
      } else {
        window.localStorage.removeItem(SELECTED_BONUS_GIFT_KEY);
      }
      notifyPromoListeners();
    }
  } catch {
    // ignore
  }
}

/**
 * Dynamically extracts all active shop products / variants priced <= 35.000₫ (with graceful tolerance up to 39.000₫
 * so existing 35k–39k keychains/hairclips added by Admin appear immediately as 0₫ selectable bonus gifts).
 */
export function getEligible35kBonusGiftChoices(
  catalogProducts: Product[],
  maxPrice: number = VD25_BONUS_GIFT_MAX_PRICE
): BonusGiftChoice[] {
  const exact35kChoices: BonusGiftChoice[] = [];
  const near35kChoices: BonusGiftChoice[] = [];

  for (const p of catalogProducts || []) {
    if (!p || !p.id || p.id.startsWith('combo_')) continue;
    if (p.isMadeToOrder === false && Number(p.quantity) <= 0) continue;

    const rawVariants = (Array.isArray(p.colorOptions) ? p.colorOptions : []).filter(
      (c) => {
        if (!c) return false;
        const lower = String(c.name || '').toLowerCase();
        return (
          !lower.includes('combo') &&
          !lower.includes('hộp quà') &&
          !lower.includes('set quà')
        );
      }
    );

    if (rawVariants.length > 0) {
      for (const v of rawVariants) {
        const vPrice =
          v.price && Number(v.price) > 0 ? Number(v.price) : Number(p.price) || 0;
        if (vPrice > 0 && vPrice <= maxPrice) {
          const choice: BonusGiftChoice = {
            id: `${p.id}__${v.id}`,
            productId: p.id,
            variantId: v.id,
            name: p.name,
            variantName: v.name,
            displayLabel:
              rawVariants.length >= 2 ? `${p.name} (${v.name})` : p.name,
            originalPrice: vPrice,
            image:
              (typeof v.image === 'string' ? v.image : null) ||
              (typeof p.image === 'string' ? p.image : null),
          };
          if (vPrice <= 35000) exact35kChoices.push(choice);
          else near35kChoices.push(choice);
        }
      }
    } else {
      const basePrice = Number(p.price) || 0;
      if (basePrice > 0 && basePrice <= maxPrice) {
        const choice: BonusGiftChoice = {
          id: `${p.id}__main`,
          productId: p.id,
          name: p.name,
          displayLabel: p.name,
          originalPrice: basePrice,
          image: typeof p.image === 'string' ? p.image : null,
        };
        if (basePrice <= 35000) exact35kChoices.push(choice);
        else near35kChoices.push(choice);
      }
    }
  }

  // If Admin has uploaded products <= 35.000₫, show ONLY <= 35.000₫ products as requested!
  // Otherwise include <= 39.000₫ items + clean fallback options so the picker is never empty.
  if (exact35kChoices.length > 0) {
    return exact35kChoices;
  }
  if (near35kChoices.length > 0) {
    return near35kChoices;
  }

  return [
    {
      id: 'gift_35k_keychain_shop_pick',
      productId: 'gift_35k_keychain_shop_pick',
      name: 'Móc khóa len thủ công 35k',
      displayLabel: 'Móc khóa len thủ công 35k (Ghi mẫu thích ở ghi chú)',
      originalPrice: 35000,
      image: null,
    },
    {
      id: 'gift_35k_hairclip_shop_pick',
      productId: 'gift_35k_hairclip_shop_pick',
      name: 'Kẹp tóc len thủ công 35k',
      displayLabel: 'Kẹp tóc len thủ công 35k (Ghi mẫu thích ở ghi chú)',
      originalPrice: 35000,
      image: null,
    },
  ];
}

export interface PromoEvaluationContext {
  hasPriorOrders?: boolean;
  usedPromoCodes?: string[];
  hasComboItems?: boolean;
}

export interface PromoEvaluationResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  voucher?: PromoVoucher;
  shortfallAmount?: number;
  error?: string;
}

const SAVED_WALLET_CODES_KEY = 'tcl_saved_voucher_wallet_v2';
const PERSONAL_WALLET_RECORDS_KEY = 'tcl_personal_mission_vouchers_v1';
const ACTIVE_PROMO_CODE_KEY = 'tcl_selected_promo_code_v2';
const ADMIN_CUSTOM_VOUCHERS_KEY = 'tcl_admin_vouchers_config_v2';
export const PROMO_OPT_OUT_SENTINEL = '__NONE__';

/**
 * Direction 2 Profit-Safe Store Vouchers:
 * - Applies strictly to non-Combo retail items (`eligibleRetailSubtotal`), NEVER double-stacking on Combo discounts.
 * - `TIEMLEN10K`: -10.000₫ for first-time customers only on retail orders >= 159.000₫.
 * - Milestone 299.000₫: Freeship 0₫ only (no extra cash voucher stacked at 299k).
 * - `VIP20K`: -20.000₫ single-use per customer on large retail orders >= 399.000₫.
 */
export const DEFAULT_PROMO_VOUCHERS: PromoVoucher[] = [
  {
    code: 'TIEMLEN10K',
    title: 'Giảm 10.000₫ (Đơn Đầu)',
    badge: '🎁 Chào Bạn Mới',
    description:
      'Đơn lẻ đầu tiên từ 159.000₫ (Không áp chồng lên các gói Combo)',
    discountAmount: 10000,
    minOrderSubtotal: 159000,
    active: true,
    newCustomerOnly: true,
    singleUsePerUser: true,
    profitSafeNote:
      'Chỉ dành cho đơn đầu tiên của khách mới & không cộng dồn với gói Combo đã giảm giá.',
  },
  {
    code: 'VIP20K',
    title: 'Giảm 20.000₫ + Freeship',
    badge: '👑 Ưu Đãi Đơn Lớn',
    description:
      'Đơn mua lẻ từ 399.000₫ (Mỗi tài khoản dùng 1 lần • Không tính món Combo)',
    discountAmount: 20000,
    minOrderSubtotal: 399000,
    active: true,
    newCustomerOnly: false,
    singleUsePerUser: true,
    profitSafeNote:
      'Dành cho đơn mua lẻ ≥399k (~5% doanh thu), mỗi tài khoản chỉ dùng đúng 1 lần.',
  },
];

export interface PersonalMissionVoucherMeta {
  code: string;
  discountAmount: number;
  minRetailSubtotal: number;
  title: string;
}

const listeners = new Set<() => void>();

function notifyPromoListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export function subscribePromoChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPersonalWalletRecords(): PersonalMissionVoucherMeta[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(PERSONAL_WALLET_RECORDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function savePersonalVoucherToWallet(
  meta: PersonalMissionVoucherMeta
): void {
  const cleanCode = String(meta.code || '')
    .trim()
    .toUpperCase();
  if (!cleanCode) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = getPersonalWalletRecords().filter(
        (r) => r.code.toUpperCase() !== cleanCode
      );
      window.localStorage.setItem(
        PERSONAL_WALLET_RECORDS_KEY,
        JSON.stringify([
          {
            code: cleanCode,
            discountAmount: meta.discountAmount,
            minRetailSubtotal: meta.minRetailSubtotal,
            title: meta.title,
          },
          ...existing,
        ])
      );
      saveVoucherToWallet(cleanCode);
    }
  } catch {
    // ignore
  }
}

export function parsePersonalMissionCodeSpec(
  rawCode: string
): PromoVoucher | null {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  const saved = getPersonalWalletRecords().find((r) => r.code === code);
  if (code.startsWith('VD25-')) {
    return {
      code,
      title:
        saved?.title ||
        'Gói Quà 60k: Giảm 25.000₫ + Tặng 1 SP 35.000₫ Tự Chọn',
      badge: '🎬 Quà Video Khui Hàng (60k)',
      description:
        'Giảm 25.000₫ + Tự chọn 1 Móc khóa / Kẹp tóc giá 35k của shop (Đơn lẻ ≥159k • Dùng 1 lần)',
      discountAmount: saved?.discountAmount || 25000,
      minOrderSubtotal: saved?.minRetailSubtotal || 159000,
      active: true,
      singleUsePerUser: true,
      isPersonalMission: true,
      grantsFreeGiftMaxPrice: 35000,
      profitSafeNote:
        'Mã riêng 1-1 khóa theo tài khoản khách quay video khui hàng + gắn link web (Giảm 25k + Tặng 1 SP 35k giá 0₫).',
    };
  }
  if (code.startsWith('FB15-')) {
    return {
      code,
      title: saved?.title || 'Giảm 15.000₫ (Quà Follow & Share Fanpage)',
      badge: '👍 Mã Riêng Của Bạn',
      description:
        'Đơn mua lẻ từ 119.000₫ (Mã độc quyền 1 tài khoản • Dùng 1 lần • Không áp chồng Combo)',
      discountAmount: saved?.discountAmount || 15000,
      minOrderSubtotal: saved?.minRetailSubtotal || 119000,
      active: true,
      singleUsePerUser: true,
      isPersonalMission: true,
      profitSafeNote: 'Mã riêng 1-1 khóa theo tài khoản khách Follow & Share công khai.',
    };
  }
  return null;
}

export function getAllPromoVouchers(): PromoVoucher[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ADMIN_CUSTOM_VOUCHERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROMO_VOUCHERS;
}

export function saveAdminPromoVouchers(vouchers: PromoVoucher[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        ADMIN_CUSTOM_VOUCHERS_KEY,
        JSON.stringify(vouchers)
      );
      notifyPromoListeners();
    }
  } catch {
    // ignore
  }
}

export function getActivePromoVouchers(
  ctx?: PromoEvaluationContext
): PromoVoucher[] {
  const usedSet = new Set(
    (ctx?.usedPromoCodes || []).map((c) => String(c || '').trim().toUpperCase())
  );

  const base = getAllPromoVouchers().filter((v) => {
    if (!v.active) return false;
    if (v.newCustomerOnly && ctx?.hasPriorOrders) return false;
    if (v.singleUsePerUser && usedSet.has(v.code.toUpperCase())) return false;
    return true;
  });

  const walletCodes = getSavedWalletCodes();
  const personalVouchers: PromoVoucher[] = [];
  for (const wCode of walletCodes) {
    const upper = String(wCode || '').trim().toUpperCase();
    if (usedSet.has(upper)) continue;
    const spec = parsePersonalMissionCodeSpec(upper);
    if (spec && !base.some((b) => b.code === spec.code)) {
      personalVouchers.push(spec);
    }
  }

  return [...personalVouchers, ...base].sort(
    (a, b) => a.minOrderSubtotal - b.minOrderSubtotal
  );
}

export function getSavedWalletCodes(): string[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SAVED_WALLET_CODES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveVoucherToWallet(rawCode: string): string[] {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  const current = getSavedWalletCodes();
  const next = Array.from(new Set([...current, code]));
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SAVED_WALLET_CODES_KEY, JSON.stringify(next));
      window.localStorage.setItem(ACTIVE_PROMO_CODE_KEY, code);
      notifyPromoListeners();
    }
  } catch {
    // ignore
  }
  return next;
}

export function markVoucherConsumedLocally(rawCode: string): void {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  if (!code) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const currentWallet = getSavedWalletCodes().filter(
        (c) => c.toUpperCase() !== code
      );
      window.localStorage.setItem(
        SAVED_WALLET_CODES_KEY,
        JSON.stringify(currentWallet)
      );
      const selected = getSelectedPromoCode();
      if (selected.toUpperCase() === code) {
        window.localStorage.removeItem(ACTIVE_PROMO_CODE_KEY);
      }
      notifyPromoListeners();
    }
  } catch {
    // ignore
  }
}

export function getSelectedPromoCode(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(ACTIVE_PROMO_CODE_KEY) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

export function setSelectedPromoCode(rawCode: string): void {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (code) {
        window.localStorage.setItem(ACTIVE_PROMO_CODE_KEY, code);
      } else {
        window.localStorage.removeItem(ACTIVE_PROMO_CODE_KEY);
      }
      notifyPromoListeners();
    }
  } catch {
    // ignore
  }
}

export function evaluatePromoCode(
  rawCode: string,
  eligibleRetailSubtotal: number,
  ctx?: PromoEvaluationContext
): PromoEvaluationResult {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase();
  if (!code || code === PROMO_OPT_OUT_SENTINEL) {
    return {
      valid: false,
      code: '',
      discountAmount: 0,
    };
  }

  if (eligibleRetailSubtotal <= 0) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      error:
        'Giỏ hàng hiện chỉ có gói Combo đã được giảm giá sẵn — Mã giảm giá chỉ áp dụng cho các sản phẩm mua lẻ nguyên giá.',
    };
  }

  const usedSet = new Set(
    (ctx?.usedPromoCodes || []).map((c) => String(c || '').trim().toUpperCase())
  );
  if (usedSet.has(code)) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      error: `Mã ${code} đã được sử dụng ở đơn hàng trước (mỗi mã chỉ áp dụng 1 lần duy nhất).`,
    };
  }

  const personalSpec = parsePersonalMissionCodeSpec(code);
  const matched =
    personalSpec ||
    getAllPromoVouchers().find(
      (v) => v.active && v.code.toUpperCase() === code
    );

  if (!matched) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      error: `Mã "${code}" không tồn tại hoặc đã hết hạn.`,
    };
  }

  if (matched.newCustomerOnly && ctx?.hasPriorOrders) {
    return {
      valid: false,
      code: matched.code,
      discountAmount: 0,
      error: `Mã ${matched.code} chỉ dành riêng cho đơn hàng đầu tiên của khách hàng mới.`,
    };
  }

  if (eligibleRetailSubtotal < matched.minOrderSubtotal) {
    const shortfall = matched.minOrderSubtotal - eligibleRetailSubtotal;
    return {
      valid: false,
      code: matched.code,
      discountAmount: 0,
      voucher: matched,
      shortfallAmount: shortfall,
      error: `Mã ${matched.code} áp dụng cho sản phẩm mua lẻ từ ${matched.minOrderSubtotal.toLocaleString(
        'vi-VN'
      )}₫ (Cần mua thêm ${shortfall.toLocaleString(
        'vi-VN'
      )}₫ sản phẩm lẻ nữa — không tính gói Combo).`,
    };
  }

  return {
    valid: true,
    code: matched.code,
    discountAmount: matched.discountAmount,
    voucher: matched,
  };
}

export function getBestApplicableVoucher(
  eligibleRetailSubtotal: number,
  ctx?: PromoEvaluationContext
): PromoVoucher | null {
  if (eligibleRetailSubtotal <= 0) return null;
  const eligible = getActivePromoVouchers(ctx).filter(
    (v) => eligibleRetailSubtotal >= v.minOrderSubtotal
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, curr) =>
    curr.discountAmount > best.discountAmount ? curr : best
  );
}

export function getNextUnlockableVoucher(
  eligibleRetailSubtotal: number,
  ctx?: PromoEvaluationContext
): {
  voucher: PromoVoucher;
  shortfall: number;
} | null {
  const next = getActivePromoVouchers(ctx).find(
    (v) => eligibleRetailSubtotal < v.minOrderSubtotal
  );
  if (!next) return null;
  return {
    voucher: next,
    shortfall: Math.max(0, next.minOrderSubtotal - eligibleRetailSubtotal),
  };
}

/**
 * Verifies a typed Promo Code (especially personal `VD25-` / `FB15-` codes) against the Server
 * so stolen/other-account codes are rejected right inside the Cart/Checkout picker!
 */
export async function validatePromoCodeWithServer(params: {
  promoCode: string;
  eligibleRetailSubtotal: number;
  email?: string;
  phone?: string;
}): Promise<{
  checkedOnServer: boolean;
  valid: boolean;
  promoCode: string;
  discountAmount: number;
  title?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return {
      checkedOnServer: false,
      valid: false,
      promoCode: '',
      discountAmount: 0,
    };
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      return {
        checkedOnServer: false,
        valid: false,
        promoCode: '',
        discountAmount: 0,
      };
    }

    const res = await fetch('/api/orders-guard', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        action: 'validate_voucher',
        promoCode: params.promoCode,
        eligibleRetailSubtotal: params.eligibleRetailSubtotal,
        email: params.email,
        phone: params.phone,
      }),
    });
    if (!res.ok) {
      return {
        checkedOnServer: false,
        valid: false,
        promoCode: '',
        discountAmount: 0,
      };
    }
    const json = await res.json();
    return {
      checkedOnServer: true,
      valid: Boolean(json?.valid),
      promoCode: String(json?.promoCode || ''),
      discountAmount: Number(json?.discountAmount || 0),
      title: json?.title ? String(json.title) : undefined,
      error: json?.error ? String(json.error) : undefined,
    };
  } catch {
    return {
      checkedOnServer: false,
      valid: false,
      promoCode: '',
      discountAmount: 0,
    };
  }
}

/**
 * Admin-only helper: calls `/api/orders-guard` (`action: 'issue_personal_voucher'`) to mint a cryptographically signed,
 * 1-to-1 account-bound personal voucher (`VD25-XXXXXX` or `FB15-XXXXXX`).
 */
export async function issuePersonalVoucherAsAdmin(params: {
  missionType: 'video_unbox_25k' | 'fb_follow_share_15k';
  targetUserId?: string;
  targetEmail?: string;
  targetCustomerName?: string;
  targetOrderId?: string;
}): Promise<{
  ok: boolean;
  code?: string;
  discountAmount?: number;
  minRetailSubtotal?: number;
  title?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Chỉ hỗ trợ trên trình duyệt Web.' };
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      return {
        ok: false,
        error: 'Phiên đăng nhập Admin đã hết hạn. Vui lòng đăng nhập lại.',
      };
    }

    const res = await fetch('/api/orders-guard', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        action: 'issue_personal_voucher',
        missionType: params.missionType,
        targetUserId: params.targetUserId || '',
        targetEmail: params.targetEmail || '',
        targetCustomerName: params.targetCustomerName || '',
        targetOrderId: params.targetOrderId || '',
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success || !json?.voucher) {
      return {
        ok: false,
        error: json?.error || 'Không thể tạo mã thưởng riêng.',
      };
    }
    return {
      ok: true,
      code: String(json.voucher.code),
      discountAmount: Number(json.voucher.discountAmount),
      minRetailSubtotal: Number(json.voucher.minRetailSubtotal),
      title: String(json.voucher.title),
    };
  } catch {
    return {
      ok: false,
      error: 'Lỗi kết nối khi cấp mã thưởng riêng.',
    };
  }
}
