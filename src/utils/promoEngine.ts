export interface PromoVoucher {
  code: string;
  title: string;
  badge: string;
  description: string;
  discountAmount: number;
  minOrderSubtotal: number;
  active: boolean;
  profitSafeNote: string;
}

export interface PromoEvaluationResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  voucher?: PromoVoucher;
  shortfallAmount?: number;
  error?: string;
}

const SAVED_WALLET_CODES_KEY = 'tcl_saved_voucher_wallet_v1';
const ACTIVE_PROMO_CODE_KEY = 'tcl_selected_promo_code_v1';
const ADMIN_CUSTOM_VOUCHERS_KEY = 'tcl_admin_vouchers_config_v1';
export const PROMO_OPT_OUT_SENTINEL = '__NONE__';

/**
 * Tiered Profit-Protected Grand Opening Vouchers:
 * Every voucher enforces a strict `minOrderSubtotal` (~8x–10x the discount amount)
 * so the shop NEVER loses money on small single-item orders (35k–55k) and actively pushes AOV higher.
 */
export const DEFAULT_PROMO_VOUCHERS: PromoVoucher[] = [
  {
    code: 'CHAOBAN10K',
    title: 'Giảm 10.000₫',
    badge: '🎁 Quà Bạn Mới',
    description: 'Đơn từ 99.000₫ (Mua từ 2 móc khóa hoặc 1 Combo nhỏ)',
    discountAmount: 10000,
    minOrderSubtotal: 99000,
    active: true,
    profitSafeNote:
      'An toàn 100%: Chặn áp mã cho đơn lẻ 35k–65k, kích thích khách mua từ 2 món (≥99k).',
  },
  {
    code: 'KHAITRUONG20K',
    title: 'Giảm 20.000₫',
    badge: '🎉 Mừng Khai Trương',
    description: 'Đơn từ 179.000₫ (Gợi ý: 1 Combo + Set Quà Tặng Đặc Biệt)',
    discountAmount: 20000,
    minOrderSubtotal: 179000,
    active: true,
    profitSafeNote:
      'An toàn 100%: Chỉ giảm ~11% khi đơn đạt ≥179k, tối ưu biên lợi nhuận gộp.',
  },
  {
    code: 'CUONLEN35K',
    title: 'Giảm 35.000₫ + Freeship',
    badge: '🔥 Siêu Hời 299k',
    description: 'Đơn từ 299.000₫ (Vừa được Freeship 0₫ + Giảm thêm 35k)',
    discountAmount: 35000,
    minOrderSubtotal: 299000,
    active: true,
    profitSafeNote:
      'Đòn bẩy gom đơn lớn ≥299k: Lợi nhuận ròng thu về trên 1 lần đóng gói cao gấp 3 lần đơn lẻ.',
  },
  {
    code: 'VIP50K',
    title: 'Giảm 50.000₫',
    badge: '👑 Đơn VIP / Quà Nhóm',
    description: 'Đơn từ 429.000₫ (Dành cho đơn mua quà nhóm / nhiều Combo)',
    discountAmount: 50000,
    minOrderSubtotal: 429000,
    active: true,
    profitSafeNote:
      'Dành cho đơn lớn ≥429k (giảm ~11.6%), giữ biên lợi nhuận cực tốt.',
  },
];

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

export function getActivePromoVouchers(): PromoVoucher[] {
  return getAllPromoVouchers()
    .filter((v) => v.active)
    .sort((a, b) => a.minOrderSubtotal - b.minOrderSubtotal);
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
  subtotal: number
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

  const vouchers = getActivePromoVouchers();
  const matched = vouchers.find((v) => v.code.toUpperCase() === code);
  if (!matched) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      error: `Mã "${code}" không tồn tại hoặc đã hết hạn. Bạn chọn mã Khai Trương bên dưới nhé!`,
    };
  }

  if (subtotal < matched.minOrderSubtotal) {
    const shortfall = matched.minOrderSubtotal - subtotal;
    return {
      valid: false,
      code: matched.code,
      discountAmount: 0,
      voucher: matched,
      shortfallAmount: shortfall,
      error: `Mã ${matched.code} áp dụng cho đơn từ ${matched.minOrderSubtotal.toLocaleString(
        'vi-VN'
      )}₫ (Cần mua thêm ${shortfall.toLocaleString('vi-VN')}₫ nữa).`,
    };
  }

  return {
    valid: true,
    code: matched.code,
    discountAmount: matched.discountAmount,
    voucher: matched,
  };
}

export function getBestApplicableVoucher(subtotal: number): PromoVoucher | null {
  const eligible = getActivePromoVouchers().filter(
    (v) => subtotal >= v.minOrderSubtotal
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, curr) =>
    curr.discountAmount > best.discountAmount ? curr : best
  );
}

export function getNextUnlockableVoucher(subtotal: number): {
  voucher: PromoVoucher;
  shortfall: number;
} | null {
  const next = getActivePromoVouchers().find(
    (v) => subtotal < v.minOrderSubtotal
  );
  if (!next) return null;
  return {
    voucher: next,
    shortfall: Math.max(0, next.minOrderSubtotal - subtotal),
  };
}
